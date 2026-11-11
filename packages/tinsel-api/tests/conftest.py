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
import sentinel_api.routes.health as health_module
from httpx import ASGITransport, AsyncClient
from sentinel_api.db.connection import get_db
from sentinel_api.db.models import APIKey, Base, Organisation
from sentinel_api.main import app
from sqlalchemy import event
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
# A second organisation, so tests can tell "may read this record" apart from
# "may read its sequence". Both keys are test fixtures and never leave SQLite.
OTHER_RAW_API_KEY = "tinsel-test-other-key-00000000"

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

    # SQLite ignores foreign keys unless asked, per connection. Without this,
    # every foreign key in the schema is untested here and fails only on
    # PostgreSQL, which is the worst place to find out.
    @event.listens_for(engine.sync_engine, "connect")
    def _enforce_foreign_keys(dbapi_connection, _record):  # type: ignore[no-untyped-def]
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

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
async def other_org(db_engine) -> Organisation:
    """A second Organisation, used to exercise non-owner access paths."""
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    org_id = uuid.uuid4()
    key_hash = hashlib.sha3_256(OTHER_RAW_API_KEY.encode()).hexdigest()

    async with factory() as session:
        org = Organisation(
            id=org_id,
            name="Other Organisation",
            api_key_hash=key_hash,
            tier="standard",
        )
        session.add(org)
        session.add(
            APIKey(
                id=uuid.uuid4(),
                org_id=org_id,
                key_prefix=OTHER_RAW_API_KEY[:8],
                key_hash=key_hash,
                label="other-test-key",
            )
        )
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

    # The health route deliberately does not use the get_db dependency: it has
    # to report "degraded" and return 503 when the pool is unreachable, which
    # it cannot do if acquiring a session is a precondition for the handler
    # running at all. It therefore reaches for the module-level factory, which
    # the dependency override above does not touch, so /health tried to open a
    # real PostgreSQL connection during tests and answered 503. Point that
    # module global at the SQLite factory for the duration of the test, leaving
    # the production behaviour exactly as it is.
    original_health_factory = health_module.async_session_factory
    health_module.async_session_factory = factory

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as ac:
            yield ac
    finally:
        health_module.async_session_factory = original_health_factory
        app.dependency_overrides.clear()


@pytest.fixture
def auth_headers() -> dict[str, str]:
    return {"X-API-Key": RAW_API_KEY}


@pytest.fixture
def other_auth_headers() -> dict[str, str]:
    """Headers for the second organisation: authenticated, but not the owner."""
    return {"X-API-Key": OTHER_RAW_API_KEY}


# ── Scoped keys and licence vocabulary for the catalogue routes ──────────────

# Three callers, because the point of scopes is the difference between them.
AGENT_RAW_API_KEY = "tinsel-test-agent-key-00000000"
OPERATOR_RAW_API_KEY = "tinsel-test-operator-key-00000000"
PLAIN_RAW_API_KEY = "tinsel-test-plain-key-00000000"


async def _add_scoped_key(factory, org_id, raw_key: str, scopes: list[str], label: str):
    """Insert an APIKey carrying *scopes* for *org_id*."""
    async with factory() as session:
        session.add(
            APIKey(
                id=uuid.uuid4(),
                org_id=org_id,
                key_prefix=raw_key[:8],
                key_hash=hashlib.sha3_256(raw_key.encode()).hexdigest(),
                label=label,
                scopes=scopes,
            )
        )
        await session.commit()


@pytest.fixture
async def scoped_keys(db_engine, test_org):
    """Keys for the agent, an operator, and a caller with public read only.

    The agent deliberately lacks catalogue:publish. Several tests assert that
    it is refused, which is the editorial control the design rests on.
    """
    from sentinel_api.scopes import (
        CATALOGUE_DRAFT,
        CATALOGUE_PUBLISH,
        READ_EMBARGOED,
        READ_PUBLIC,
        REGISTRY_DEPOSIT,
    )

    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    await _add_scoped_key(
        factory, test_org.id, AGENT_RAW_API_KEY,
        [READ_PUBLIC, CATALOGUE_DRAFT], "genome-watch-agent",
    )
    await _add_scoped_key(
        factory, test_org.id, OPERATOR_RAW_API_KEY,
        [READ_PUBLIC, READ_EMBARGOED, CATALOGUE_DRAFT, CATALOGUE_PUBLISH, REGISTRY_DEPOSIT],
        "operator",
    )
    await _add_scoped_key(
        factory, test_org.id, PLAIN_RAW_API_KEY, [READ_PUBLIC], "public-read",
    )
    return {
        "agent": {"X-API-Key": AGENT_RAW_API_KEY},
        "operator": {"X-API-Key": OPERATOR_RAW_API_KEY},
        "plain": {"X-API-Key": PLAIN_RAW_API_KEY},
    }


@pytest.fixture
async def licences(db_engine):
    """Seed the licences the catalogue tests reference.

    Migration 010 seeds the full vocabulary, but tests build the schema with
    metadata.create_all and never run migrations, so the rows have to be put
    here. allows_redistribution is the column the hosting decision reads.
    """
    from sentinel_api.db.catalogue import License

    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    rows = [
        ("CC-BY-4.0", "Creative Commons Attribution 4.0", True, True, True, True),
        ("CC0-1.0", "Creative Commons Zero v1.0", True, True, True, False),
        (
            "CC-BY-NC-ND-4.0",
            "CC Attribution-NonCommercial-NoDerivatives 4.0",
            False, False, False, True,
        ),
        ("UNSTATED", "No licence stated", False, False, False, True),
    ]
    async with factory() as session:
        for spdx, name, redis, deriv, comm, attr in rows:
            session.add(
                License(
                    spdx_id=spdx, name=name, url=None,
                    allows_redistribution=redis, allows_derivatives=deriv,
                    allows_commercial=comm, requires_attribution=attr, notes=None,
                )
            )
        await session.commit()
