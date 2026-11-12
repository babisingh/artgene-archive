"""Accession number allocation, shared by both record classes.

Certificates take ``AG-YYYY-NNNNNN`` and catalogue records ``AGC-YYYY-NNNNNN``
from separate counters, so the two sequences never interleave and a bare
accession always says which kind of claim it is.

Allocation holds a row lock for the rest of the transaction. For certificates
that also makes the audit chain head read safe, because the holder is the only
one appending. A PostgreSQL SEQUENCE would be the conventional choice and is
wrong here: sequence values are consumed even when the transaction rolls back,
and the audit chain needs contiguous numbers to be auditable, since a gap is
indistinguishable from a removed entry.

On SQLite, which the test suite uses, row locking is a no-op because writes are
already serialised at the database level. The guarantee is a PostgreSQL one.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sentinel_api.db.models import RegistryCounter

#: Counter behind AG- certificate accessions, and the audit chain sequence.
AUDIT_SEQ_COUNTER = "audit_seq_num"
#: Counter behind AGC- catalogue accessions.
CATALOGUE_SEQ_COUNTER = "catalogue_seq_num"


async def allocate_sequence_number(
    db: AsyncSession,
    counter_name: str,
    *,
    seed: Callable[[], Awaitable[int]] | None = None,
) -> int:
    """Allocate and return the next value of *counter_name*.

    Parameters
    ----------
    seed:
        Called only when the counter row does not exist, to decide where to
        start. Migrations seed both counters on a real database, so this path is
        reached by schemas built with ``metadata.create_all``, which the test
        suite does. Passing a seed lets a caller keep numbering contiguous with
        data that is already present; the default start is 1.
    """
    result = await db.execute(
        select(RegistryCounter)
        .where(RegistryCounter.name == counter_name)
        .with_for_update()
    )
    counter = result.scalars().first()

    if counter is None:
        start = await seed() if seed is not None else 1
        counter = RegistryCounter(name=counter_name, next_value=start)
        db.add(counter)
        await db.flush()

    allocated: int = counter.next_value
    counter.next_value = allocated + 1
    await db.flush()
    return allocated


def format_accession(prefix: str, year: int, number: int) -> str:
    """Render an accession, for example ``AGC-2026-000001``.

    Six digits is the registry's committed width. Overflowing it would be a
    good problem, and would need a decision about the format rather than a
    silently wider field, so this refuses instead.
    """
    if number > 999_999:
        raise ValueError(
            f"accession number {number} exceeds the six-digit "
            f"{prefix}-YYYY-NNNNNN format"
        )
    return f"{prefix}-{year}-{number:06d}"
