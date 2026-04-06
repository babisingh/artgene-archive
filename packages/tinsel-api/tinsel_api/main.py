"""FastAPI application entry-point with Mangum Lambda adapter."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from tinsel_api.routes import gates, sequences

app = FastAPI(
    title="ArtGene / Tinsel API",
    description="Bioinformatics sequence analysis and gate orchestration.",
    version="0.1.0",
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

app.include_router(sequences.router, prefix="/sequences", tags=["sequences"])
app.include_router(gates.router, prefix="/gates", tags=["gates"])


@app.get("/health", tags=["meta"])
async def health() -> dict:
    return {"status": "ok", "version": "0.1.0"}


# AWS Lambda / API Gateway handler
handler = Mangum(app, lifespan="off")
