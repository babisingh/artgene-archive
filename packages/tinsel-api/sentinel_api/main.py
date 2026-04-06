"""FastAPI application — ArtGene / TINSEL API v1.

Entry-points
------------
uvicorn sentinel_api.main:app --reload        # local dev
AWS Lambda: handler = Mangum(app)            # deployed via Lambda container
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from sentinel_api.routes import health, register, certificates, pathways

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────
app.include_router(health.router, prefix="/api/v1", tags=["meta"])
app.include_router(register.router, prefix="/api/v1", tags=["registration"])
app.include_router(
    certificates.router, prefix="/api/v1/certificates", tags=["certificates"]
)
app.include_router(pathways.router, prefix="/api/v1/pathways", tags=["pathways"])

# ── AWS Lambda adapter ────────────────────────────────────────────────────
handler = Mangum(app, lifespan="off")
