"""FastAPI application — ArtGene Archive API v1.

Entry-points
------------
uvicorn sentinel_api.main:app --reload        # local dev
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from mangum import Mangum
from slowapi.errors import RateLimitExceeded

from sentinel_api.config import settings
from sentinel_api.rate_limit import limiter
from sentinel_api.routes import analyse, certificates, distributions, health, pathways, register, structure

logger = logging.getLogger(__name__)

app = FastAPI(
    title="ArtGene Archive API",
    description=(
        "Biosafety-gated registration and provenance tracing for synthetic sequences."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Attach the slowapi limiter state and install the rate-limit error handler.
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def _rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "detail": (
                f"Rate limit exceeded: {exc.detail}. "
                "Please slow down your requests and try again shortly."
            )
        },
        headers={"Retry-After": "60"},
    )


@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all for exceptions that escape route handlers (e.g. DB errors in dependencies).

    Logs the full traceback so it appears in Railway / container logs, then
    returns a structured 500 that the frontend can inspect for the error code.
    """
    logger.exception(
        "Unhandled exception on %s %s — %s: %s",
        request.method,
        request.url.path,
        type(exc).__name__,
        exc,
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": {
                "code": "INTERNAL_ERROR",
                "message": (
                    "The server encountered an internal error. "
                    "Please try again. If the problem persists, contact support."
                ),
            }
        },
    )


app.add_middleware(
    CORSMiddleware,
    # Restricted to explicit origins — never wildcard with credentials=True.
    # Set ALLOWED_ORIGINS=https://your-domain.com in production environment.
    allow_origins=settings.parsed_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key"],
)

# ── Routes ────────────────────────────────────────────────────────────────
app.include_router(health.router, prefix="/api/v1", tags=["meta"])
app.include_router(register.router, prefix="/api/v1", tags=["registration"])
app.include_router(
    certificates.router, prefix="/api/v1/certificates", tags=["certificates"]
)
app.include_router(pathways.router, prefix="/api/v1/pathways", tags=["pathways"])
app.include_router(analyse.router, prefix="/api/v1", tags=["demo"])
app.include_router(structure.router, prefix="/api/v1", tags=["demo"])
app.include_router(distributions.router, prefix="/api/v1", tags=["provenance"])

# ── Startup diagnostics ───────────────────────────────────────────────────

@app.on_event("startup")
async def _startup_diagnostics() -> None:
    """Log DB + vault connectivity on startup so Railway logs show the state immediately."""
    from sqlalchemy import text
    from sentinel_api.db.connection import async_session_factory
    from sentinel_api.vault import get_vault_client

    db_status = "connected"
    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = f"DISCONNECTED ({type(exc).__name__}: {exc})"

    vault_status = "connected"
    try:
        vault = get_vault_client()
        await vault.get_spreading_key(settings.spreading_key_id)
    except Exception as exc:
        vault_status = f"DISCONNECTED ({type(exc).__name__}: {exc})"

    level = logging.WARNING if "DISCONNECTED" in db_status or "DISCONNECTED" in vault_status else logging.INFO
    logger.log(
        level,
        "Startup — env=%s  db=%s  vault=%s",
        settings.sentinel_env,
        db_status,
        vault_status,
    )


# ── AWS Lambda adapter ────────────────────────────────────────────────────
handler = Mangum(app, lifespan="on")
