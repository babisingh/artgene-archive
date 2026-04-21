"""FastAPI application — ArtGene / TINSEL API v1.

Entry-points
------------
uvicorn sentinel_api.main:app --reload        # local dev
AWS Lambda: handler = Mangum(app)            # deployed via Lambda container
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from mangum import Mangum
from slowapi.errors import RateLimitExceeded

from sentinel_api.config import settings
from sentinel_api.rate_limit import limiter
from sentinel_api.routes import analyse, certificates, health, pathways, register, structure

app = FastAPI(
    title="ArtGene / TINSEL API",
    description=(
        "Traceable Identity Notation for Sequence Encryption + Ledger — "
        "biosafety-gated registration and certification of synthetic sequences."
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

# ── AWS Lambda adapter ────────────────────────────────────────────────────
handler = Mangum(app, lifespan="off")
