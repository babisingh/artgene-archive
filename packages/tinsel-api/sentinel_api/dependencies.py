"""FastAPI dependencies — authentication and shared resources."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from sentinel_api.db.connection import get_db
from sentinel_api.db.models import APIKey, Organisation


async def require_api_key(
    x_api_key: str = Header(..., alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
) -> Organisation:
    """Validate the ``X-API-Key`` header and return the owning Organisation.

    The raw key is SHA3-256-hashed and compared to ``api_keys.key_hash``.
    Raw keys are never stored.

    Raises
    ------
    HTTPException 401
        If the key is missing, unknown, or revoked.
    """
    key_hash = hashlib.sha3_256(x_api_key.encode()).hexdigest()

    result = await db.execute(
        select(Organisation)
        .join(APIKey, APIKey.org_id == Organisation.id)
        .where(APIKey.key_hash == key_hash, APIKey.revoked_at.is_(None))
    )
    org = result.scalars().first()

    if org is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    await db.execute(
        update(APIKey)
        .where(APIKey.key_hash == key_hash, APIKey.revoked_at.is_(None))
        .values(last_used_at=datetime.now(timezone.utc))
    )

    return org
