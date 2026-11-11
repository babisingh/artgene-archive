"""Application settings loaded from environment / .env file."""

from __future__ import annotations

from urllib.parse import urlsplit

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_VALID_ENVS = frozenset({"test", "development", "production"})

# Hosts that can only be a developer's own machine or a compose network. Used by
# _reject_dev_mode_against_remote_db below: "development" is a privileged mode
# (mock biosafety gates, a seed script that creates a known API key), so it is
# only allowed to talk to a database that cannot be a real one. "db" is the
# service name in docker-compose.yml; "postgres" is the common alternative.
_LOCAL_DB_HOSTS = frozenset({"localhost", "127.0.0.1", "::1", "db", "postgres", ""})


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
    # Dev default — intentionally weak so it fails loudly in production.
    # Generate a real key: python -c "import secrets; print(secrets.token_hex(32))"
    spreading_key: str = "aa" * 32
    spreading_key_id: str = "local-dev-key"

    @field_validator("spreading_key")
    @classmethod
    def _validate_spreading_key_hex(cls, v: str) -> str:
        try:
            raw = bytes.fromhex(v)
        except ValueError as exc:
            raise ValueError(f"SPREADING_KEY must be a valid hex string: {exc}") from exc
        if len(raw) != 32:
            raise ValueError(
                f"SPREADING_KEY must encode exactly 32 bytes (64 hex chars), got {len(raw)}"
            )
        return v

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

    @model_validator(mode="after")
    def _reject_insecure_production_key(self) -> Settings:
        if self.sentinel_env == "production" and self.spreading_key == "aa" * 32:
            raise ValueError(
                "SPREADING_KEY is still the insecure development default in production mode. "
                "Set SPREADING_KEY to a random 64-char hex string in your Railway/environment variables. "
                "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        return self

    @model_validator(mode="after")
    def _reject_dev_mode_against_remote_db(self) -> Settings:
        """Refuse to run in development mode against a database that is not local.

        SENTINEL_ENV defaults to "development" here, in start.sh and in the
        shell prompt line, so a service deployed with the variable simply absent
        would silently run in development mode. That has two consequences worth
        refusing outright: the biosafety gates fall back to mock adapters, and
        start.sh runs seed_dev.py, which creates an organisation whose API key is
        published in this repository. One missing environment variable would hand
        the internet a working key and switch screening off.

        Rather than trusting the variable to be present, infer the risk from the
        database it is pointed at: a development deployment that can reach a
        non-local database is a misconfiguration regardless of intent.
        """
        if self.sentinel_env != "development":
            return self

        # Fail closed: a URL we cannot parse is treated as remote, since the
        # whole point is to refuse development mode when we cannot prove the
        # database is local.
        try:
            host = (urlsplit(self.database_url).hostname or "").lower()
        except ValueError:
            host = "<unparseable>"

        if host not in _LOCAL_DB_HOSTS:
            raise ValueError(
                f"SENTINEL_ENV=development with a non-local database host ({host!r}). "
                "Development mode uses mock biosafety gates and seeds a publicly "
                "known API key, so it must never point at a real database. "
                "Set SENTINEL_ENV=production for a deployed service, or point "
                "DATABASE_URL at localhost for local work."
            )
        return self

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
