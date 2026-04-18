"""Gate 4 adapter — functional analogue detection via embedding cosine similarity.

Scientific motivation
---------------------
The Microsoft/Science 2025 challenge: AI-designed protein variants can retain
dangerous biological function while diverging far from known sequences, evading
Gates 1-3 which operate in sequence space.  Protein language model embeddings
(ESM-2, ProtTrans) capture *function*, not just sequence.  Two proteins with
cosine similarity ≥ 0.85 in ESM-2 embedding space are highly likely to share
functional mechanisms, regardless of sequence identity.

Demo / development mode (composition_fingerprint_v1)
------------------------------------------------------
Uses a 420-D amino acid + dipeptide composition vector instead of ESM-2.
  - No GPU or large model download required
  - Scientifically meaningful: amino acid composition correlates with broad
    functional class (RIPs, pore-formers, ADP-ribosyltransferases each have
    distinct compositional signatures)
  - Clearly labelled so reviewers understand it is NOT ESM-2
  - Threshold 0.85 retained; score interpretation shown in dashboard

Cosine similarity thresholds:
  ≥ 0.85  →  FAIL  (high functional similarity to dangerous protein family)
  ≥ 0.70  →  WARN  (moderate similarity — warrants expert review)
  < 0.70  →  PASS

Production path (ESM-2)
------------------------
Set use_esm2=True and ensure the Hugging Face Inference API key is configured:
    HUGGINGFACE_API_KEY=hf_xxxx
    ESM2_ENDPOINT=https://api-inference.huggingface.co/models/facebook/esm2_t33_650M_UR50D
Or run a local ESM-2 server and point ESM2_ENDPOINT at it.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from tinsel.consequence import Gate4Result
from tinsel.models import GateStatus

from tinsel_gates.adapters.base import Gate4Adapter
from tinsel_gates.adapters.gate4.reference_db import (
    FINGERPRINT_DIM,
    screen_protein,
)

logger = logging.getLogger(__name__)

_THRESHOLD_FAIL = 0.85
_THRESHOLD_WARN = 0.70
_METHOD_DEMO = "composition_fingerprint_v1"
_METHOD_PROD = "esm2_cosine_v1"

_DEMO_NOTE = (
    "DEMO MODE: similarity scores computed via 420-D amino acid + dipeptide "
    "composition fingerprint (NOT ESM-2). In production, replace with ESM-2 "
    "650M mean-pooled embeddings for full functional analogue detection power. "
    f"Threshold: FAIL ≥ {_THRESHOLD_FAIL}, WARN ≥ {_THRESHOLD_WARN}."
)


async def _get_esm2_embedding(protein: str, endpoint: str, api_key: str) -> list[float]:
    """Call Hugging Face Inference API (or local ESM-2 server) for embedding.

    Returns mean-pooled 1280-D embedding vector (ESM-2 650M hidden size).
    """
    import httpx

    headers = {"Authorization": f"Bearer {api_key}"}
    payload = {"inputs": protein, "options": {"wait_for_model": True}}

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(endpoint, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    # HF feature-extraction pipeline returns shape (1, seq_len, hidden_dim)
    # Mean-pool over sequence length dimension
    embedding = data[0]          # shape: (seq_len, hidden_dim)
    n = len(embedding)
    dim = len(embedding[0])
    mean_vec = [sum(embedding[i][j] for i in range(n)) / n for j in range(dim)]

    # L2-normalise
    import math
    norm = math.sqrt(sum(v * v for v in mean_vec))
    return [v / norm for v in mean_vec] if norm > 0 else mean_vec


class FunctionalEmbeddingGate4Adapter(Gate4Adapter):
    """Gate 4 implementation: functional analogue detection.

    Demo mode:  composition_fingerprint_v1 (420-D, no external dependencies)
    Prod mode:  esm2_cosine_v1             (1280-D, ESM-2 650M via HF API)
    """

    mock_mode = False

    def __init__(
        self,
        *,
        use_esm2: bool = False,
        esm2_endpoint: str = "",
        esm2_api_key: str = "",
        threshold_fail: float = _THRESHOLD_FAIL,
        threshold_warn: float = _THRESHOLD_WARN,
    ) -> None:
        self._use_esm2 = use_esm2
        self._esm2_endpoint = esm2_endpoint
        self._esm2_api_key = esm2_api_key
        self._threshold_fail = threshold_fail
        self._threshold_warn = threshold_warn

    async def run(self, dna: str, protein: str) -> Gate4Result:
        seq = protein.upper().strip()
        if not seq:
            return Gate4Result(
                status=GateStatus.PASS,
                method=_METHOD_DEMO,
                message="Empty sequence — Gate 4 skipped",
            )

        if self._use_esm2:
            return await self._run_esm2(seq)
        return await self._run_composition(seq)

    async def _run_composition(self, protein: str) -> Gate4Result:
        result = screen_protein(
            protein,
            threshold_fail=self._threshold_fail,
            threshold_warn=self._threshold_warn,
        )
        status: GateStatus = result["status"]
        max_sim: float = result["max_similarity"]
        top_hits: list[dict] = result["top_hits"]

        if status == GateStatus.FAIL:
            worst = top_hits[0]
            msg = (
                f"FUNCTIONAL ANALOGUE DETECTED: '{worst['family']}' "
                f"(cosine similarity {max_sim:.4f} ≥ fail threshold {self._threshold_fail}). "
                f"Protein may share dangerous function despite sequence divergence."
            )
        elif status == GateStatus.WARN:
            worst = top_hits[0]
            msg = (
                f"Moderate functional similarity to '{worst['family']}' "
                f"(cosine similarity {max_sim:.4f} ≥ warn threshold {self._threshold_warn}). "
                "Expert review recommended."
            )
        else:
            msg = (
                f"No dangerous functional analogues detected "
                f"(max cosine similarity {max_sim:.4f} < warn threshold {self._threshold_warn}). "
                f"{result['references_screened']} reference families screened."
            )

        logger.info(
            "Gate 4 [composition]: status=%s max_sim=%.4f refs=%d",
            status.value, max_sim, result["references_screened"],
        )

        return Gate4Result(
            status=status,
            method=_METHOD_DEMO,
            query_dimensions=result["query_dimensions"],
            references_screened=result["references_screened"],
            threshold_fail=self._threshold_fail,
            threshold_warn=self._threshold_warn,
            max_similarity=max_sim,
            top_hits=top_hits,
            message=msg,
            note=_DEMO_NOTE,
        )

    async def _run_esm2(self, protein: str) -> Gate4Result:
        """ESM-2 production path via Hugging Face Inference API."""
        import math

        from tinsel_gates.adapters.gate4.reference_db import (
            REFERENCE_FAMILIES,
            _compute_fingerprint,
            _cosine,
        )

        try:
            query_emb = await _get_esm2_embedding(
                protein, self._esm2_endpoint, self._esm2_api_key
            )
        except Exception as exc:
            logger.warning("ESM-2 API call failed (%s) — falling back to composition", exc)
            return await self._run_composition(protein)

        # Compute reference ESM-2 embeddings on-the-fly (would normally be pre-cached)
        hits: list[dict] = []
        for ref in REFERENCE_FAMILIES:
            ref_emb = await _get_esm2_embedding(
                ref["sequence"], self._esm2_endpoint, self._esm2_api_key
            )
            sim = _cosine(query_emb, ref_emb)
            sim_status = (
                "fail" if sim >= self._threshold_fail else
                "warn" if sim >= self._threshold_warn else
                "pass"
            )
            hits.append({
                "family": ref["family"],
                "organism": ref["organism"],
                "uniprot": ref["uniprot"],
                "category": ref["category"],
                "similarity": sim,
                "threshold_fail": self._threshold_fail,
                "threshold_warn": self._threshold_warn,
                "status": sim_status,
            })

        hits.sort(key=lambda h: -h["similarity"])
        max_sim = hits[0]["similarity"] if hits else 0.0
        dim = len(query_emb)

        if max_sim >= self._threshold_fail:
            status = GateStatus.FAIL
            msg = (
                f"ESM-2 FUNCTIONAL ANALOGUE DETECTED: '{hits[0]['family']}' "
                f"(cosine {max_sim:.4f} ≥ {self._threshold_fail})"
            )
        elif max_sim >= self._threshold_warn:
            status = GateStatus.WARN
            msg = f"ESM-2 moderate similarity to '{hits[0]['family']}' (cosine {max_sim:.4f})"
        else:
            status = GateStatus.PASS
            msg = f"ESM-2 no dangerous analogues detected (max cosine {max_sim:.4f})"

        return Gate4Result(
            status=status,
            method=_METHOD_PROD,
            query_dimensions=dim,
            references_screened=len(REFERENCE_FAMILIES),
            threshold_fail=self._threshold_fail,
            threshold_warn=self._threshold_warn,
            max_similarity=max_sim,
            top_hits=hits,
            message=msg,
            note=f"ESM-2 650M mean-pooled embeddings ({dim}-D). Threshold: FAIL ≥ {self._threshold_fail}.",
        )
