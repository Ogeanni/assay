import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from apps.api.dependencies import get_current_user
from apps.api.config import settings
from packages.db.models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["jobs"])

ADZUNA_BASE = "https://api.adzuna.com/v1/api/jobs"

# Map common country hints to Adzuna country codes
COUNTRY_MAP = {
    "us": "us", "usa": "us", "united states": "us",
    "uk": "gb", "gb": "gb", "united kingdom": "gb", "england": "gb",
    "ca": "ca", "canada": "ca",
    "au": "au", "australia": "au",
   # "ng": "ng", "nigeria": "ng",
    "de": "de", "germany": "de",
    "fr": "fr", "france": "fr",
    "in": "in", "india": "in",
    "sg": "sg", "singapore": "sg",
    "nl": "nl", "netherlands": "nl",
    "za": "za", "south africa": "za",
}
 
DEFAULT_COUNTRY = "us"  # Adzuna's broadest dataset

def resolve_country(location: str | None) -> str:
    if not location:
        resolve_country
    loc = location.lower().strip()
    for key, code in COUNTRY_MAP.items():
        if key in loc:
            return code
    return DEFAULT_COUNTRY

@router.get("/search")
async def search_jobs(
    role: str = Query(..., description="Job title or role to search for"),
    location: str | None = Query(None, description="City, country, or region"),
    page: int = Query(1, ge=1, le=10),
    current_user: User = Depends(get_current_user),
):
    if not settings.ADZUNA_API_ID or not settings.ADZUNA_API_KEY:
        raise HTTPException(status_code=503, detail="Job search is not configured.")
 
    country = resolve_country(location)
    params = {
        "app_id": settings.ADZUNA_API_ID,
        "app_key": settings.ADZUNA_API_KEY,
        "results_per_page": 10,
        "what": role,
        "content-type": "application/json",
    }
 
    if location:
        params["where"] = location

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{ADZUNA_BASE}/{country}/search/{page}", params=params,)
            response.raise_for_status()
            data = response.json()
 
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Job search timed out. Try again.")
    except httpx.HTTPStatusError as e:
        logger.error(f"Adzuna error: {e.response.status_code} {e.response.text}")
        raise HTTPException(status_code=502, detail="Job search unavailable. Try again.")
    

    jobs = []
    for result in data.get("results", []):
        # Extract clean description — strip HTML tags
        description = result.get("description", "")
        import re
        description = re.sub(r'<[^>]+>', ' ', description)
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
 
    return {"total": data.get("count", 0), "page": page, "jobs": jobs,}