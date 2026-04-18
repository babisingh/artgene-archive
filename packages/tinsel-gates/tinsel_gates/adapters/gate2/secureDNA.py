"""Gate 2 sub-adapter — SecureDNA DOPRF hazard screening.

Real SecureDNA overview
-----------------------
SecureDNA (https://securedna.org) uses a Distributed Oblivious Pseudorandom
Function (DOPRF) protocol to screen DNA sequences against a cryptographically
maintained hazard database.  The protocol is privacy-preserving: the client
transforms 30-nucleotide windows into opaque cryptographic tokens before
sending them to the server.  The server checks each token against its hazard
database without learning the plaintext sequence.

Window parameters (SecureDNA v2 standard):
  - Window size: 30 bp
  - Stride:      1 bp (exhaustive sliding window)
  - Any hit      → FAIL immediately

Mock implementation (this file)
--------------------------------
The mock simulates the DOPRF flow by:
  1. Sliding a 30-bp window over the DNA sequence.
  2. Comparing each window against a small set of DEMO-ONLY trigger patterns.
     These are clearly fictional sequences, NOT real pathogen sequences.
  3. Returning a result that mirrors the real SecureDNA API response shape.

To trigger a FAIL in demo/dev mode, include one of these 30-mers in the DNA:
  ATGAAGAAATTTGGGAAACCCATTTTTGCG  →  Demo Hazard Alpha
  GCGATGAACGAGATGAAGGATGCGATTATG  →  Demo Hazard Beta

Production integration
----------------------
Replace _screen_doprf_mock() with a call to the SecureDNA synthesis gateway.
The client library is available at: https://github.com/SecureDNA/securedna-clients
"""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone

from tinsel.consequence import Gate2Result
from tinsel.models import GateStatus

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Demo-only hazard 30-mers (FICTIONAL — NOT real pathogen sequences)
# In production these patterns live in the SecureDNA encrypted hazard DB.
# ---------------------------------------------------------------------------

_DEMO_HAZARD_30MERS: list[tuple[str, str]] = [
    ("ATGAAGAAATTTGGGAAACCCATTTTTGCG", "Demo Hazard Alpha (fictional demo trigger)"),
    ("GCGATGAACGAGATGAAGGATGCGATTATG", "Demo Hazard Beta (fictional demo trigger)"),
    ("CAGCTGAAACTTCAAAAAATGCAGCAGCAG", "Demo Hazard Gamma (fictional demo trigger)"),
]

_WINDOW_SIZE = 30
_SECUREDNA_VERSION = "2.0-mock"
_SECUREDNA_DB_VERSION = "2026-Q1-mock"


def _doprf_token(window: str) -> str:
    """Simulate the DOPRF cryptographic token for a 30-mer window.

    Real DOPRF: client applies a blinding factor, server evaluates PRF,
    client unblinds.  Here we use SHA3-256 of the window as a stand-in.
    """
    return hashlib.sha3_256(window.upper().encode()).hexdigest()[:16]


def _screen_doprf_mock(dna: str) -> tuple[list[dict], int]:
    """Slide 30-bp windows over dna and check against demo hazard patterns.

    Returns (hits, windows_screened).
    """
    seq = dna.upper().replace(" ", "").replace("\n", "")
    n = len(seq)
    if n < _WINDOW_SIZE:
        return [], max(0, n)

    windows_screened = n - _WINDOW_SIZE + 1
    hits: list[dict] = []

    hazard_map = {m.upper(): desc for m, desc in _DEMO_HAZARD_30MERS}

    for i in range(windows_screened):
        window = seq[i : i + _WINDOW_SIZE]
        if window in hazard_map:
            token = _doprf_token(window)
            hits.append({
                "position": i + 1,
                "window_length": _WINDOW_SIZE,
                "doprf_token": token,
                "hazard_label": hazard_map[window],
                "confidence": 1.0,
            })

    # Deduplicate: keep first hit per hazard label
    seen: set[str] = set()
    deduped: list[dict] = []
    for h in hits:
        if h["hazard_label"] not in seen:
            seen.add(h["hazard_label"])
            deduped.append(h)

    return deduped, windows_screened


async def run_secureDNA_screen(dna: str, mock: bool = True) -> dict:
    """Run SecureDNA DOPRF screening and return structured result dict.

    Parameters
    ----------
    dna:
        Coding DNA sequence (nucleotides only).
    mock:
        If True, use the demo mock implementation.
        If False, call the real SecureDNA API (requires credentials).
    """
    queried_at = datetime.now(timezone.utc).isoformat()

    if mock:
        hits, windows_screened = _screen_doprf_mock(dna)
        status = GateStatus.FAIL if hits else GateStatus.PASS
        return {
            "checked": True,
            "mock": True,
            "windows_screened": windows_screened,
            "hits": hits,
            "status": status,
            "db_entry": {
                "name": "SecureDNA DOPRF",
                "version": _SECUREDNA_VERSION,
                "db_version": _SECUREDNA_DB_VERSION,
                "method": "doprf_30mer_mock",
                "windows_screened": windows_screened,
                "status": status.value,
                "queried_at": queried_at,
            },
        }

    # ── Production path (requires SecureDNA client library + credentials) ──
    # Example integration (pseudocode):
    #   from securedna_client import SynthesisClient
    #   client = SynthesisClient(api_key=settings.SECUREDNA_API_KEY)
    #   result = await client.screen(dna)
    #   hits = result.hazard_hits
    raise NotImplementedError(
        "Real SecureDNA integration requires the securedna-client library "
        "and valid API credentials. Set SECUREDNA_API_KEY in environment."
    )
