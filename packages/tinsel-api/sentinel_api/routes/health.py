"""Health check endpoints.

Public endpoint (/health):
    Returns minimal status — intentionally omits environment name and
    internal configuration details to avoid leaking which code paths are
    active (real vs mock gates, vault type, etc.) to unauthenticated callers.

Authenticated endpoint (/health/detail):
    Returns full diagnostics including env, vault type, and gate mode.
    Requires a valid API key.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text

from sentinel_api.config import settings
from sentinel_api.db.connection import async_session_factory
from sentinel_api.db.models import Organisation
from sentinel_api.dependencies import require_api_key
from sentinel_api.vault import get_vault_client

router = APIRouter()


async def _connectivity() -> tuple[str, str]:
    """Check DB and vault connectivity; return (db_status, vault_status)."""
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

    return db_status, vault_status


@router.get("/health")
async def health() -> dict:
    """Public liveness probe — minimal response, no internal details."""
    db_status, vault_status = await _connectivity()
    # NOTE: env is intentionally omitted — it would reveal whether mock
    # biosafety gates are active and which vault implementation is running.
    return {
        "status": "ok" if db_status == "connected" and vault_status == "connected" else "degraded",
        "version": "1.0.0",
        "db": db_status,
        "vault": vault_status,
    }


@router.get("/health/detail")
async def health_detail(org: Organisation = Depends(require_api_key)) -> dict:
    """Authenticated diagnostics endpoint — returns env and full status."""
    db_status, vault_status = await _connectivity()
    return {
        "status": "ok" if db_status == "connected" and vault_status == "connected" else "degraded",
        "version": "1.0.0",
        "env": settings.sentinel_env,
        "db": db_status,
        "vault": vault_status,
        "org_id": str(org.id),
    }
