"""Application settings loaded from environment / .env file."""

from __future__ import annotations

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_VALID_ENVS = frozenset({"test", "development", "production"})


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Database ────────────────────────────────────────────────────────────
    database_url: str = (
        "postgresql://postgres:tinsel_local_password@localhost:5432/artgene"
    )

    @property
    def database_url_async(self) -> str:
        """asyncpg-compatible URL (replaces postgresql:// → postgresql+asyncpg://)."""
        return self.database_url.replace(
            "postgresql://", "postgresql+asyncpg://", 1
        ).replace(
            "postgres://", "postgresql+asyncpg://", 1
        )

    # ── TINSEL Spreading Key ────────────────────────────────────────────────
    spreading_key: str = "aa" * 32          # 32-byte dev default (hex)
    spreading_key_id: str = "local-dev-key"

    # ── CORS ────────────────────────────────────────────────────────────────
    # Comma-separated list of allowed origins for CORS.
    # Dev default: localhost dashboard only.
    # Production: set ALLOWED_ORIGINS=https://your-domain.com in the environment.
    # NEVER set to "*" in production — credentials are included in API requests.
    allowed_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    # ── Runtime ────────────────────────────────────────────────────────────
    sentinel_env: str = "development"       # must be: test | development | production
    log_level: str = "INFO"

    @field_validator("sentinel_env")
    @classmethod
    def _validate_env(cls, v: str) -> str:
        if v not in _VALID_ENVS:
            raise ValueError(
                f"SENTINEL_ENV={v!r} is not recognised. "
                f"Valid values: {sorted(_VALID_ENVS)}. "
                "A typo here silently activates mock biosafety gates for all submissions."
            )
        return v

    # ── AWS ────────────────────────────────────────────────────────────────
    aws_region: str = "eu-west-1"
    aws_account_id: str = ""

    # ── External APIs ───────────────────────────────────────────────────────
    ncbi_email: str = ""
    ncbi_api_key: str = ""
    esmfold_api_url: str = "https://api.esmatlas.com/foldSequence/v1/pdb/"


settings = Settings()
