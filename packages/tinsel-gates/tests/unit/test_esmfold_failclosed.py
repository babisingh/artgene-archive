"""Fail-closed behaviour for the real ESMFold Gate 1 adapter (GATE-02).

When ESMFold cannot assess a structure (sequence too long, API error, or an
unparseable PDB) the gate must degrade to WARN — never a synthetic PASS with a
fabricated pLDDT.  These tests monkeypatch httpx so no network call is made.
"""


import httpx
import pytest
from tinsel.models import GateStatus
from tinsel_gates.adapters.gate1.esmfold import ESMFOLD_MAX_LENGTH, ESMFoldGate1Adapter

_SHORT_PROTEIN = "MKAILVGTASKPYSEQNRDWFHC" * 3  # ~69 AA, well under the limit


async def test_long_sequence_degrades_to_warn_not_pass():
    protein = "A" * (ESMFOLD_MAX_LENGTH + 25)
    res = await ESMFoldGate1Adapter().run("", protein)
    assert res.status == GateStatus.WARN
    assert res.plddt_mean is None
    assert res.plddt_per_residue is None
    assert res.instability_index is not None  # sequence-only metric still reported


async def test_api_transport_error_fails_closed(monkeypatch):
    async def _boom(*args, **kwargs):
        raise httpx.ConnectError("simulated outage")

    monkeypatch.setattr(httpx.AsyncClient, "post", _boom)
    res = await ESMFoldGate1Adapter().run("", _SHORT_PROTEIN)
    assert res.status == GateStatus.WARN, "API outage must not yield a PASS"
    assert res.plddt_mean is None


async def test_timeout_fails_closed(monkeypatch):
    async def _timeout(*args, **kwargs):
        raise TimeoutError()

    monkeypatch.setattr(httpx.AsyncClient, "post", _timeout)
    res = await ESMFoldGate1Adapter().run("", _SHORT_PROTEIN)
    assert res.status == GateStatus.WARN
    assert res.plddt_mean is None


async def test_unparseable_pdb_fails_closed(monkeypatch):
    class _Resp:
        text = "GARBAGE — not a PDB file"

        def raise_for_status(self):
            return None

    async def _ok(*args, **kwargs):
        return _Resp()

    monkeypatch.setattr(httpx.AsyncClient, "post", _ok)
    res = await ESMFoldGate1Adapter().run("", _SHORT_PROTEIN)
    assert res.status == GateStatus.WARN, "Unparseable structure must not yield a PASS"
    assert res.plddt_mean is None


async def test_unexpected_error_propagates(monkeypatch):
    """Non-transport errors must NOT be silently swallowed into a WARN/PASS."""
    async def _unexpected(*args, **kwargs):
        raise RuntimeError("bug, not a network error")

    monkeypatch.setattr(httpx.AsyncClient, "post", _unexpected)
    with pytest.raises(RuntimeError):
        await ESMFoldGate1Adapter().run("", _SHORT_PROTEIN)
