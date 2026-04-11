"""Health check endpoint — public, no auth required."""

from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from sentinel_api.config import settings
from sentinel_api.db.connection import async_session_factory
from sentinel_api.vault import get_vault_client

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    """Return service health including DB and vault connectivity."""
    db_status = "connected"
    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = f"disconnected ({type(exc).__name__})"

    vault_status = "connected"
    try:
        vault = get_vault_client()
        await vault.get_spreading_key(settings.spreading_key_id)
    except Exception as exc:
        vault_status = f"disconnected ({type(exc).__name__})"

    return {
        "status": "ok",
        "version": "1.0.0",
        "env": settings.sentinel_env,
        "db": db_status,
        "vault": vault_status,
    }
