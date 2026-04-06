"""Application settings loaded from environment / .env file."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


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

    # ── Runtime ────────────────────────────────────────────────────────────
    sentinel_env: str = "development"       # test | development | production
    log_level: str = "INFO"

    # ── AWS ────────────────────────────────────────────────────────────────
    aws_region: str = "eu-west-1"
    aws_account_id: str = ""

    # ── External APIs ───────────────────────────────────────────────────────
    ncbi_email: str = ""
    ncbi_api_key: str = ""
    esmfold_api_url: str = "https://api.esmatlas.com/foldSequence/v1/pdb/"


settings = Settings()
