"""The registry ledger: an append-only, hash-chained entry for every AG accession.

Every AG number, whether issued by ``/register`` or by ``/submissions``, comes
from one counter and gets one ledger entry, so the numbering stays unique and
the chain stays contiguous. The table refuses deletes at the database level
(trigger ``audit_log_immutable``), which is the point: it is the archive's
record of what it issued and when.

Entries must be written while the counter row lock taken by
``allocate_sequence_number`` is held. Without it, two transactions could both
extend the chain from the same previous hash.
"""

from __future__ import annotations

import hashlib

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from sentinel_api.db.models import RegistryAuditLog


def entry_hash(seq_num: int, prev_hash: str, content_hash: str) -> str:
    """SHA3-256 over the entry's fields, chaining it to the one before."""
    return hashlib.sha3_256(f"{seq_num}|{prev_hash}|{content_hash}".encode()).hexdigest()


async def highest_audit_seq_plus_one(db: AsyncSession) -> int:
    """Where a fresh counter should start so numbering stays contiguous."""
    highest = (
        await db.execute(select(func.coalesce(func.max(RegistryAuditLog.seq_num), 0)))
    ).scalar_one()
    return int(highest) + 1


async def prev_entry_hash(db: AsyncSession) -> str:
    """The most recent entry's hash, or zeros for the first entry."""
    row = (
        await db.execute(
            select(RegistryAuditLog.entry_hash_hex)
            .order_by(RegistryAuditLog.seq_num.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    return row if row is not None else "0" * 64
