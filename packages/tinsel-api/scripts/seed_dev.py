#!/usr/bin/env python3
"""Idempotent dev seed — creates a default org + API key if none exists.

Safe to run on every startup. Prints the API key so it can be pasted
into the dashboard "Set API Key" field.
"""
from __future__ import annotations

import asyncio
import hashlib
import uuid

from sqlalchemy import select

from sentinel_api.db.connection import async_session_factory
from sentinel_api.db.models import APIKey, Organisation

RAW_KEY = "tinsel-dev-key-00000000"
ORG_NAME = "dev-org"


async def seed() -> None:
    async with async_session_factory() as db:
        result = await db.execute(
            select(Organisation).where(Organisation.name == ORG_NAME)
        )
        existing = result.scalars().first()
        if existing is not None:
            print(f"[seed] Dev org already exists — API key: {RAW_KEY}")
            return

        org = Organisation(
            id=uuid.uuid4(),
            name=ORG_NAME,
            api_key_hash=hashlib.sha3_256(RAW_KEY.encode()).hexdigest(),
            tier="standard",
        )
        db.add(org)
        await db.flush()

        key = APIKey(
            id=uuid.uuid4(),
            org_id=org.id,
            key_prefix=RAW_KEY[:8],
            key_hash=hashlib.sha3_256(RAW_KEY.encode()).hexdigest(),
            label="dev",
        )
        db.add(key)
        await db.commit()

    print("=" * 60)
    print("  Dev org seeded successfully")
    print(f"  API key: {RAW_KEY}")
    print("  Paste this into the dashboard 'Set API Key' field.")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(seed())
