"""Idempotent development seed — creates a dev organisation and API key.

Run automatically by docker-compose on every `up`. Safe to run multiple times;
if the dev org already exists it prints the key and exits without making changes.

Dev API key: tinsel-dev-key-00000000
"""

import asyncio
import hashlib
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sentinel_api.db.connection import async_session_factory
from sentinel_api.db.models import APIKey, Organisation

RAW_KEY = "tinsel-dev-key-00000000"
KEY_HASH = hashlib.sha3_256(RAW_KEY.encode()).hexdigest()
ORG_NAME = "dev-org"


async def seed() -> None:
    async with async_session_factory() as db:
        # Idempotency check — skip if org already exists
        result = await db.execute(
            select(Organisation).where(Organisation.name == ORG_NAME)
        )
        existing = result.scalars().first()
        if existing is not None:
            print(f"[seed] Dev org already exists.")
            print(f"[seed] API key: {RAW_KEY}")
            return

        org = Organisation(
            id=uuid.uuid4(),
            name=ORG_NAME,
            api_key_hash=KEY_HASH,
            tier="standard",
        )
        db.add(org)
        await db.flush()

        key = APIKey(
            id=uuid.uuid4(),
            org_id=org.id,
            key_prefix=RAW_KEY[:8],
            key_hash=KEY_HASH,
            label="dev",
        )
        db.add(key)
        await db.commit()

    print(f"[seed] Dev org and API key created.")
    print(f"[seed] API key: {RAW_KEY}")


if __name__ == "__main__":
    asyncio.run(seed())
