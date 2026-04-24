"""Idempotent production seed — creates the default organisation and API key.

Runs on every container start (via start.sh). Safe to run multiple times;
skips silently if the default org already exists.

API key precedence:
  1. ARTGENE_API_KEY env var  — set this in Railway to pin a stable key
  2. Auto-generated token     — printed to startup logs on first run; retrieve
                                once from Railway's deployment log pane
"""

from __future__ import annotations

import asyncio
import hashlib
import os
import secrets
import uuid

from sqlalchemy import select

from sentinel_api.db.connection import async_session_factory
from sentinel_api.db.models import APIKey, Organisation

ORG_NAME = "default"


async def seed() -> None:
    async with async_session_factory() as db:
        result = await db.execute(
            select(Organisation).where(Organisation.name == ORG_NAME)
        )
        if result.scalars().first() is not None:
            print("[seed-prod] Default org already exists — skipping.")
            return

        raw_key = os.environ.get("ARTGENE_API_KEY") or secrets.token_urlsafe(32)
        key_hash = hashlib.sha3_256(raw_key.encode()).hexdigest()

        org = Organisation(
            id=uuid.uuid4(),
            name=ORG_NAME,
            api_key_hash=key_hash,
            tier="standard",
        )
        db.add(org)
        await db.flush()

        key = APIKey(
            id=uuid.uuid4(),
            org_id=org.id,
            key_prefix=raw_key[:8],
            key_hash=key_hash,
            label="production",
        )
        db.add(key)
        await db.commit()

    print("=" * 60)
    print("  [seed-prod] Default org created")
    print(f"  API key : {raw_key}")
    print("  Set ARTGENE_API_KEY in Railway to pin this key permanently.")
    print("  Set API_KEY (dashboard service) to the same value.")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(seed())
