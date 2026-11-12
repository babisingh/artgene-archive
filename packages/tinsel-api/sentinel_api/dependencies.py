"""FastAPI dependencies: authentication, authorisation, shared resources.

Three layers, in increasing strictness:

``require_api_key``
    Returns the Organisation. What the pre-existing routes use. Unscoped, so
    any valid key passes. Left alone deliberately: adding scope requirements to
    live endpoints is a breaking change that belongs in its own step.

``require_principal``
    Returns who is calling, including which key and what it may do.

``require_scope(...)``
    Returns a dependency that rejects a caller lacking the named scopes. This
    is what keeps the Genome Watch agent from publishing: it holds
    ``catalogue:draft`` and not ``catalogue:publish``, so the publish route
    refuses it on every request rather than relying on the agent to behave.
"""

from __future__ import annotations

import hashlib
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from sentinel_api.db.connection import get_db
from sentinel_api.db.models import APIKey, Organisation
from sentinel_api.scopes import ADMIN

_UNAUTHORISED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid, expired or revoked API key",
    headers={"WWW-Authenticate": "ApiKey"},
)


@dataclass(frozen=True)
class Principal:
    """Who is making this request, and what they may do."""

    org: Organisation
    key_id: uuid.UUID
    scopes: frozenset[str]

    def has(self, scope: str) -> bool:
        """True if this caller holds *scope*. ``admin`` implies everything."""
        return ADMIN in self.scopes or scope in self.scopes


async def _resolve_key(x_api_key: str, db: AsyncSession) -> tuple[Organisation, APIKey]:
    """Look up the organisation and key record for a raw key.

    The raw key is high entropy, so a single SHA3-256 hash lookup against an
    indexed column is the right primitive: a slow KDF would add latency to
    every request and buy nothing against an attacker who cannot guess the key.
    Raw keys are never stored.
    """
    key_hash = hashlib.sha3_256(x_api_key.encode()).hexdigest()

    result = await db.execute(
        select(Organisation, APIKey)
        .join(APIKey, APIKey.org_id == Organisation.id)
        .where(APIKey.key_hash == key_hash, APIKey.revoked_at.is_(None))
    )
    row = result.first()
    if row is None:
        raise _UNAUTHORISED

    org, api_key = row

    # Expiry exists so a key can be rotated by overlapping a replacement rather
    # than by a flag day. An expired key is as good as revoked.
    now = datetime.now(UTC)
    if api_key.expires_at is not None and api_key.expires_at <= now:
        raise _UNAUTHORISED

    await db.execute(
        update(APIKey).where(APIKey.id == api_key.id).values(last_used_at=now)
    )

    return org, api_key


async def require_api_key(
    x_api_key: str = Header(..., alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
) -> Organisation:
    """Validate the ``X-API-Key`` header and return the owning Organisation."""
    org, _ = await _resolve_key(x_api_key, db)
    return org


async def require_principal(
    x_api_key: str = Header(..., alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
) -> Principal:
    """Validate the key and return the caller, scopes included."""
    org, api_key = await _resolve_key(x_api_key, db)
    return Principal(
        org=org,
        key_id=api_key.id,
        scopes=frozenset(api_key.scopes or ()),
    )


def require_scope(*needed: str) -> Callable[..., Awaitable[Principal]]:
    """Build a dependency that requires every scope in *needed*.

    403 rather than 401: the caller proved who they are, and the answer is that
    they may not do this. 404 would be the right answer for hiding the
    existence of a resource, which is a different question and handled at the
    route.
    """

    async def _dependency(
        principal: Principal = Depends(require_principal),
    ) -> Principal:
        missing = sorted(s for s in needed if not principal.has(s))
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "INSUFFICIENT_SCOPE",
                    "message": (
                        "This key does not carry the scope required for that "
                        "action."
                    ),
                    "missing_scopes": missing,
                },
            )
        return principal

    return _dependency
