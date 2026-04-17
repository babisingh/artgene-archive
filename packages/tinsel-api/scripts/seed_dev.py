<<<<<<< HEAD
#!/usr/bin/env python3
"""Idempotent dev seed — creates a default org + API key if none exists.

Safe to run on every startup. Prints the API key so it can be pasted
into the dashboard "Set API Key" field.
"""
from __future__ import annotations
=======
"""Idempotent development seed — creates a dev organisation and API key.

Run automatically by docker-compose on every `up`. Safe to run multiple times;
if the dev org already exists it prints the key and exits without making changes.

Dev API key: tinsel-dev-key-00000000
"""
>>>>>>> f9e77e1088a2e93f15991bac3fd424d36070a099

import asyncio
import hashlib
import uuid

from sqlalchemy import select
<<<<<<< HEAD
=======
from sqlalchemy.ext.asyncio import AsyncSession
>>>>>>> f9e77e1088a2e93f15991bac3fd424d36070a099

from sentinel_api.db.connection import async_session_factory
from sentinel_api.db.models import APIKey, Organisation

RAW_KEY = "tinsel-dev-key-00000000"
<<<<<<< HEAD
=======
KEY_HASH = hashlib.sha3_256(RAW_KEY.encode()).hexdigest()
>>>>>>> f9e77e1088a2e93f15991bac3fd424d36070a099
ORG_NAME = "dev-org"


async def seed() -> None:
    async with async_session_factory() as db:
<<<<<<< HEAD
=======
        # Idempotency check — skip if org already exists
>>>>>>> f9e77e1088a2e93f15991bac3fd424d36070a099
        result = await db.execute(
            select(Organisation).where(Organisation.name == ORG_NAME)
        )
        existing = result.scalars().first()
        if existing is not None:
<<<<<<< HEAD
            print(f"[seed] Dev org already exists — API key: {RAW_KEY}")
=======
            print(f"[seed] Dev org already exists.")
            print(f"[seed] API key: {RAW_KEY}")
>>>>>>> f9e77e1088a2e93f15991bac3fd424d36070a099
            return

        org = Organisation(
            id=uuid.uuid4(),
            name=ORG_NAME,
<<<<<<< HEAD
            api_key_hash=hashlib.sha3_256(RAW_KEY.encode()).hexdigest(),
=======
            api_key_hash=KEY_HASH,
>>>>>>> f9e77e1088a2e93f15991bac3fd424d36070a099
            tier="standard",
        )
        db.add(org)
        await db.flush()

        key = APIKey(
            id=uuid.uuid4(),
            org_id=org.id,
            key_prefix=RAW_KEY[:8],
<<<<<<< HEAD
            key_hash=hashlib.sha3_256(RAW_KEY.encode()).hexdigest(),
=======
            key_hash=KEY_HASH,
>>>>>>> f9e77e1088a2e93f15991bac3fd424d36070a099
            label="dev",
        )
        db.add(key)
        await db.commit()

<<<<<<< HEAD
    print("=" * 60)
    print("  Dev org seeded successfully")
    print(f"  API key: {RAW_KEY}")
    print("  Paste this into the dashboard 'Set API Key' field.")
    print("=" * 60)
=======
    print(f"[seed] Dev org and API key created.")
    print(f"[seed] API key: {RAW_KEY}")
>>>>>>> f9e77e1088a2e93f15991bac3fd424d36070a099


if __name__ == "__main__":
    asyncio.run(seed())
