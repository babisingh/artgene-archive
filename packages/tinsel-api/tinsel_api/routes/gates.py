"""Gate analysis endpoints — run the sentinel_gates pipeline."""

from fastapi import APIRouter
from pydantic import BaseModel
from sentinel_gates.adapters.mock_esmfold import MockESMFoldAdapter
from sentinel_gates.adapters.mock_ncbi_blast import MockNCBIBlastAdapter
from sentinel_gates.adapters.mock_toxinpred import MockToxinPredAdapter
from sentinel_gates.pipeline import GatePipeline
from tinsel.models import PipelineResult, SequenceType

router = APIRouter()


class GateRunRequest(BaseModel):
    sequence_id: str
    sequence: str
    seq_type: SequenceType = SequenceType.PROTEIN


@router.post("/run", response_model=PipelineResult)
async def run_gates(body: GateRunRequest) -> PipelineResult:
    """Run all configured gates against a sequence and return the aggregated result."""
    adapters = [
        MockESMFoldAdapter(),
        MockNCBIBlastAdapter(),
        MockToxinPredAdapter(),
    ]
    pipeline = GatePipeline(adapters, parallel=True)
    async with pipeline:
        result = await pipeline.run(
            sequence_id=body.sequence_id,
            sequence=body.sequence,
        )
    return result
