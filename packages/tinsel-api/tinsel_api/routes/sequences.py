"""Sequence CRUD endpoints."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from tinsel.models import SequenceRecord, SequenceType

router = APIRouter()

# In-memory store (replace with a real DB in Phase 3+)
_store: dict[str, SequenceRecord] = {}


class SequenceCreateRequest(BaseModel):
    id: str
    sequence: str
    seq_type: SequenceType
    description: str | None = None


@router.post("/", response_model=SequenceRecord, status_code=201)
async def create_sequence(body: SequenceCreateRequest) -> SequenceRecord:
    if body.id in _store:
        raise HTTPException(status_code=409, detail=f"Sequence '{body.id}' already exists")
    record = SequenceRecord(**body.model_dump())
    _store[record.id] = record
    return record


@router.get("/{sequence_id}", response_model=SequenceRecord)
async def get_sequence(sequence_id: str) -> SequenceRecord:
    record = _store.get(sequence_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Sequence '{sequence_id}' not found")
    return record


@router.get("/", response_model=list[SequenceRecord])
async def list_sequences() -> list[SequenceRecord]:
    return list(_store.values())


@router.delete("/{sequence_id}", status_code=204)
async def delete_sequence(sequence_id: str) -> None:
    if sequence_id not in _store:
        raise HTTPException(status_code=404, detail=f"Sequence '{sequence_id}' not found")
    del _store[sequence_id]
