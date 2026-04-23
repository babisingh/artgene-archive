"""Shared test fixtures for tinsel-api.

Uses SQLite + aiosqlite in-memory for fast, isolated tests without a
running PostgreSQL instance.  The JSONB columns are mapped to SQLite JSON
(TEXT) via a one-time type-compiler patch applied at module load time,
before any table-creation calls occur.
"""

from __future__ import annotations

import hashlib
import os
import uuid

# Set SENTINEL_ENV=test BEFORE importing any sentinel_api module so that
# pydantic-settings picks up the value when it initialises the Settings
# singleton. In "test" mode the pipeline uses fully-mock biosafety adapters,
# which is correct for unit/integration tests that don't have real DBs or
# external API access.
os.environ.setdefault("SENTINEL_ENV", "test")

import pytest
from httpx import ASGITransport, AsyncClient
from sentinel_api.db.connection import get_db
from sentinel_api.db.models import APIKey, Base, Organisation
from sentinel_api.main import app
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# ── SQLite / JSONB compatibility patch ───────────────────────────────────────
# The ORM models use sqlalchemy.dialects.postgresql.JSONB.  SQLite's type
# compiler doesn't know JSONB, so we teach it to render JSONB as JSON (TEXT).
# This patch has no effect on PostgreSQL because it only modifies the
# SQLiteTypeCompiler class.


def _sqlite_visit_jsonb(
    self: SQLiteTypeCompiler, type_: object, **kw: object
) -> str:
    return "JSON"


SQLiteTypeCompiler.visit_JSONB = _sqlite_visit_jsonb  # type: ignore[attr-defined]
# ─────────────────────────────────────────────────────────────────────────────


# ── Constants ────────────────────────────────────────────────────────────────

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"
RAW_API_KEY = "tinsel-test-api-key-00000000"

PROTEIN_OK = "HAEGTFTSDVSSYLEGQAAKEFIAWLVKGRCEGVLGDTFR" * 4
PROTEIN_OK2 = "MKTIIALSYIFCLVFA" * 10  # second distinct protein for sequential ID tests

FASTA_OK = f">test|protein|OK\n{PROTEIN_OK}"
FASTA_OK2 = f">test|protein|OK2\n{PROTEIN_OK2}"
FASTA_TOO_SHORT = ">test|short\nMAE"


# ── Engine / session fixtures ─────────────────────────────────────────────────

@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
async def db_engine():
    """Create a fresh SQLite in-memory engine with all tables for each test."""
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def test_org(db_engine) -> Organisation:
    """Insert a test Organisation + APIKey and return the Organisation."""
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    org_id = uuid.uuid4()
    key_hash = hashlib.sha3_256(RAW_API_KEY.encode()).hexdigest()

    async with factory() as session:
        org = Organisation(
            id=org_id,
            name="Test Organisation",
            api_key_hash=key_hash,
            tier="standard",
        )
        api_key = APIKey(
            id=uuid.uuid4(),
            org_id=org_id,
            key_prefix=RAW_API_KEY[:8],
            key_hash=key_hash,
            label="test-key",
        )
        session.add(org)
        session.add(api_key)
        await session.commit()

    return org


@pytest.fixture
async def client(db_engine, test_org) -> AsyncClient:
    """HTTPX async client wired to the FastAPI app with a SQLite DB override."""
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)

    async def _override_get_db():
        async with factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = _override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"X-API-Key": RAW_API_KEY}
