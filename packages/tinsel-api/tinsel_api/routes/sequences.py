"""Sequence CRUD endpoints — backed by the sentinel_api PostgreSQL DB."""

from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from tinsel.models import SequenceRecord, SequenceType

from sentinel_api.db.connection import async_session_factory
from sentinel_api.db.models import Sequence

router = APIRouter()


# ---------------------------------------------------------------------------
# DB dependency (reuses sentinel_api session factory)
# ---------------------------------------------------------------------------

async def get_db() -> AsyncIterator[AsyncSession]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ---------------------------------------------------------------------------
# Request schema
# ---------------------------------------------------------------------------

class SequenceCreateRequest(BaseModel):
    id: str
    sequence: str
    seq_type: SequenceType
    description: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_record(row: Sequence) -> SequenceRecord:
    return SequenceRecord(
        id=row.id,
        sequence=row.sequence,
        seq_type=SequenceType(row.seq_type),
        description=row.description,
        metadata=row.metadata_,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/", response_model=SequenceRecord, status_code=201)
async def create_sequence(
    body: SequenceCreateRequest,
    db: AsyncSession = Depends(get_db),
) -> SequenceRecord:
    existing = await db.get(Sequence, body.id)
    if existing is not None:
        raise HTTPException(status_code=409, detail=f"Sequence '{body.id}' already exists")
    row = Sequence(
        id=body.id,
        sequence=body.sequence,
        seq_type=body.seq_type.value,
        description=body.description,
        metadata_={},
    )
    db.add(row)
    return _to_record(row)


@router.get("/{sequence_id}", response_model=SequenceRecord)
async def get_sequence(
    sequence_id: str,
    db: AsyncSession = Depends(get_db),
) -> SequenceRecord:
    row = await db.get(Sequence, sequence_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Sequence '{sequence_id}' not found")
    return _to_record(row)


@router.get("/", response_model=list[SequenceRecord])
async def list_sequences(
    db: AsyncSession = Depends(get_db),
) -> list[SequenceRecord]:
    result = await db.execute(select(Sequence).order_by(Sequence.created_at))
    return [_to_record(r) for r in result.scalars().all()]


@router.delete("/{sequence_id}", status_code=204)
async def delete_sequence(
    sequence_id: str,
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        delete(Sequence).where(Sequence.id == sequence_id)
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail=f"Sequence '{sequence_id}' not found")
