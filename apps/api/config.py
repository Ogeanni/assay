import json
from enum import Enum
from typing import Any
from typing import Literal, Optional

from pydantic import model_validator
from pydantic_settings import BaseSettings
from pydantic import Field


class Environment(str, Enum):
    development = "development"
    staging = "staging"
    production = "production"


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    APP_ENV: Environment = Environment.development
    RESEND_API_KEY: str = ""
    FRONTEND_URL: str = "http://localhost:5173"
    OPENAI_API_KEY: str = ""
    CHAT_MODEL: str = "gpt-4o-mini"
    EMBEDDING_MODEL: str = "text-embedding-3-small"
    ALLOWED_ORIGINS: Any = None
    BACKEND_URL: str = "https://api.assayai.site/api/v1"


    VECTOR_STORE_BACKEND: Literal["chromadb", "pinecone"] = "chromadb"

    CHROMA_PERSIST_DIR: str = "data/chroma"
    CHROMA_COLLECTION_NAME: str = "assay_knowledge"

    PINECONE_API_KEY: Optional[str] = Field(default=None)
    PINECONE_INDEX_NAME: str = "assay-knowledge"
    PINECONE_DEFAULT_NAMESPACE: str = "global"

     # ── OAuth ────────────────────────────────────────
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    LINKEDIN_CLIENT_ID: str = ""
    LINKEDIN_CLIENT_SECRET: str = ""

    # ── Job search ────────────────────────────────────
    ADZUNA_API_ID: str = ""
    ADZUNA_API_KEY: str = ""

    @property
    def use_pinecone(self) -> bool:
        return self.VECTOR_STORE_BACKEND == "pinecone"

    def get_allowed_origins(self) -> list[str]:
        raw = self.ALLOWED_ORIGINS
        if raw is None:
            return ["http://localhost:5173", "http://localhost:3000"]
        if isinstance(raw, list):
            return raw
        raw = str(raw).strip()
        if raw.startswith("["):
            return json.loads(raw)
        return [i.strip() for i in raw.split(",")]

    @model_validator(mode="after")
    def validate_environment_rules(self):
        errors = []

        if not self.SECRET_KEY:
            errors.append("SECRET_KEY is required")

        if not self.DATABASE_URL:
            errors.append("DATABASE_URL is required")

        if self.APP_ENV == Environment.production:
            if not self.RESEND_API_KEY:
                errors.append("RESEND_API_KEY required in production")
            if not self.OPENAI_API_KEY:
                errors.append("OPENAI_API_KEY required in production")

        if errors:
            raise ValueError(
                "Configuration errors:\n" + "\n".join(f"- {e}" for e in errors)
            )

        return self

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        protected_namespaces = ()
        extra = "ignore"


settings = Settings()