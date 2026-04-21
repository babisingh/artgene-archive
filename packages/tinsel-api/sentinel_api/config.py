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
        env_ignore_empty=True,
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
    # Comma-separated string of allowed origins for CORS.
    # Stored as a plain string to prevent pydantic-settings from attempting
    # JSON parsing on the raw environment variable value.
    # Dev default: localhost dashboard only.
    # Production: set ALLOWED_ORIGINS=https://your-domain.com in the environment.
    # NEVER set to "*" in production — credentials are included in API requests.
    allowed_origins: str = "http://localhost:3000,http://localhost:3001"

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def _parse_allowed_origins(cls, v: object) -> str:
        """Normalise the raw env value to a non-empty comma-separated string."""
        if not v:
            return "http://localhost:3000,http://localhost:3001"
        if isinstance(v, list):
            return ",".join(str(o).strip() for o in v if str(o).strip())
        return str(v)

    @property
    def parsed_allowed_origins(self) -> list[str]:
        """Return allowed origins as a list, suitable for CORSMiddleware."""
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

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
