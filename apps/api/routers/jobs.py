import logging
import re
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from apps.api.dependencies import get_current_user
from apps.api.config import settings
from packages.db.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/jobs", tags=["jobs"])

ADZUNA_BASE = "https://api.adzuna.com/v1/api/jobs"

COUNTRY_MAP = {
    "us": "us", "usa": "us", "united states": "us",
    "uk": "gb", "gb": "gb", "united kingdom": "gb", "england": "gb",
    "ca": "ca", "canada": "ca",
    "au": "au", "australia": "au",
    "ng": "ng", "nigeria": "ng",
    "de": "de", "germany": "de",
    "fr": "fr", "france": "fr",
    "in": "in", "india": "in",
    "sg": "sg", "singapore": "sg",
    "nl": "nl", "netherlands": "nl",
    "za": "za", "south africa": "za",
    "nz": "nz", "new zealand": "nz",
    "ie": "ie", "ireland": "ie",
    "br": "br", "brazil": "br",
    "at": "at", "austria": "at",
    "be": "be", "belgium": "be",
    "ch": "ch", "switzerland": "ch",
    "mx": "mx", "mexico": "mx",
    "pl": "pl", "poland": "pl",
    "it": "it", "italy": "it",
    "es": "es", "spain": "es",
}

DEFAULT_COUNTRY = "us"

DATE_FILTER_MAP = {
    "24h": 1,
    "7d":  7,
    "30d": 30,
    "60d": 60,
}


def resolve_country(location: str | None) -> tuple[str, str | None, bool]:
    """Returns (country_code, where_param, is_remote)."""
    if not location:
        return DEFAULT_COUNTRY, None, False

    loc = location.lower().strip()

    if loc in ("remote", "worldwide", "anywhere", "global", "remote worldwide"):
        return DEFAULT_COUNTRY, None, True

    for key, code in COUNTRY_MAP.items():
        if key in loc:
            return code, location, False

    return DEFAULT_COUNTRY, location, False


@router.get("/search")
async def search_jobs(
    role: str = Query(...),
    location: str | None = Query(None),
    date_filter: str | None = Query(None, description="24h | 7d | 30d | 60d"),
    page: int = Query(1, ge=1, le=10),
    current_user: User = Depends(get_current_user),
):
    if not settings.ADZUNA_API_ID or not settings.ADZUNA_API_KEY:
        raise HTTPException(status_code=503, detail="Job search is not configured.")

    country, where_param, is_remote = resolve_country(location)
    search_role = f"remote {role}" if is_remote else role

    params = {
        "app_id": settings.ADZUNA_API_ID,
        "app_key": settings.ADZUNA_API_KEY,
        "results_per_page": 10,
        "what": search_role,
        "content-type": "application/json",
        "sort_by": "date",
        "max_days_old": DATE_FILTER_MAP.get(date_filter, 60),
    }

    if where_param:
        params["where"] = where_param

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{ADZUNA_BASE}/{country}/search/{page}",
                params=params,
            )
            response.raise_for_status()
            data = response.json()

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Job search timed out. Try again.")
    except httpx.HTTPStatusError as e:
        logger.error(f"Adzuna error: {e.response.status_code} {e.response.text}")
        raise HTTPException(status_code=502, detail="Job search unavailable. Try again.")

    jobs = []
    for result in data.get("results", []):
        description = re.sub(r'<[^>]+>', ' ', result.get("description", ""))
        description = re.sub(r'\s+', ' ', description).strip()
        jobs.append({
            "id": result.get("id", ""),
            "title": result.get("title", ""),
            "company": result.get("company", {}).get("display_name", ""),
            "location": result.get("location", {}).get("display_name", ""),
            "description": description,
            "salary_min": result.get("salary_min"),
            "salary_max": result.get("salary_max"),
            "contract_type": result.get("contract_type", ""),
            "created": result.get("created", ""),
            "redirect_url": result.get("redirect_url", ""),
        })

    return {"total": data.get("count", 0), "page": page, "jobs": jobs}