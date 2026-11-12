"""Idempotent development seed: creates a dev organisation and API key.

Run automatically by docker-compose on every `up`, and by start.sh when
SENTINEL_ENV is exactly "development". Safe to run repeatedly.

The key is NOT a constant in this repository. This file previously carried
`RAW_KEY = "tinsel-dev-key-00000000"`, which is a working credential published
in a public repo: harmless while it only ever reaches a local database, and a
live account the moment a deployment runs in development mode by accident. Pin
your own key in an untracked .env via ARTGENE_DEV_API_KEY, or let this script
generate a random one and print it once.

See also: Settings._reject_dev_mode_against_remote_db in config.py, which
refuses development mode against any non-local database, and start.sh, which
requires SENTINEL_ENV to be set explicitly.
"""

from __future__ import annotations

import asyncio
import hashlib
import os
import secrets
import sys
import uuid
from urllib.parse import urlsplit

from sentinel_api.config import settings
from sentinel_api.db.connection import async_session_factory
from sentinel_api.db.models import APIKey, Organisation
from sqlalchemy import select

ORG_NAME = "dev-org"

# Mirrors _LOCAL_DB_HOSTS in config.py. Duplicated deliberately: this script is
# a credential-creating entry point, so it should not be able to run against a
# real database even if someone relaxes the settings validator later.
_LOCAL_DB_HOSTS = frozenset({"localhost", "127.0.0.1", "::1", "db", "postgres", ""})


def _refuse_unless_local_development() -> None:
    """Exit non-zero unless this is unmistakably a local development database."""
    if settings.sentinel_env != "development":
        sys.exit(
            f"[seed-dev] refusing to run: SENTINEL_ENV={settings.sentinel_env!r}. "
            "This script creates an organisation and an API key, so it only runs "
            "in development. Production uses seed_prod.py."
        )

    try:
        host = (urlsplit(settings.database_url).hostname or "").lower()
    except ValueError:
        host = "<unparseable>"

    if host not in _LOCAL_DB_HOSTS:
        sys.exit(
            f"[seed-dev] refusing to run: database host {host!r} is not local. "
            "Seeding a known development key into a reachable database would "
            "create a public account on it."
        )


async def seed() -> None:
    _refuse_unless_local_development()

    # A key pinned in the environment keeps local work convenient across
    # container restarts without ever committing the value.
    pinned = os.environ.get("ARTGENE_DEV_API_KEY")
    raw_key = pinned or f"dev-{secrets.token_urlsafe(24)}"
    key_hash = hashlib.sha3_256(raw_key.encode()).hexdigest()

    async with async_session_factory() as db:
        result = await db.execute(
            select(Organisation).where(Organisation.name == ORG_NAME)
        )
        if result.scalars().first() is not None:
            # Only the hash is stored, so an existing org's key cannot be
            # reprinted. Say so instead of printing a value that may be wrong.
            print("[seed-dev] Dev org already exists; its key is stored as a hash.")
            if pinned:
                print("[seed-dev] ARTGENE_DEV_API_KEY is set, so use that value.")
            else:
                print(
                    "[seed-dev] To get a usable key, set ARTGENE_DEV_API_KEY and "
                    "reseed, or drop the pgdata volume to start clean."
                )
            return

        org = Organisation(
            id=uuid.uuid4(),
            name=ORG_NAME,
            api_key_hash=key_hash,
            tier="standard",
        )
        db.add(org)
        await db.flush()

        db.add(
            APIKey(
                id=uuid.uuid4(),
                org_id=org.id,
                key_prefix=raw_key[:8],
                key_hash=key_hash,
                label="dev",
            )
        )
        await db.commit()

    print("=" * 68)
    print("  Dev org seeded.")
    if pinned:
        print("  API key: taken from ARTGENE_DEV_API_KEY")
    else:
        print(f"  API key: {raw_key}")
        print("  Shown once. Put it in sessionStorage via the dashboard, or")
        print("  set ARTGENE_DEV_API_KEY to pin it across reseeds.")
    print("=" * 68)


if __name__ == "__main__":
    asyncio.run(seed())
