"""Direct submission: what the route does with each screening outcome.

Screening is replaced by a fixed result in these tests. The gates are tested
elsewhere; what matters here is what happens to a submission once screening has
spoken, and that must not depend on how one particular sequence happens to score.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from sentinel_api.db.catalogue import (
    CatalogueRecord,
    Notification,
    Record,
    SequenceBlob,
    Submission,
)
from sentinel_api.db.enquiry import DoNotContact, email_fingerprint
from sentinel_api.db.models import FragmentKmerIndex, RegistryAuditLog
from sentinel_api.enquiries import pepper
from sentinel_api.screening import ScreenResult
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from tests.conftest import FASTA_OK, FASTA_OK2

EMAIL = "submitter@example.org"
TARGET = "an example binding target"


def _payload(fasta: str = FASTA_OK, **over) -> dict:
    payload = {
        "title": "Designed binder for testing",
        "summary": "A record created by the test suite.",
        "molecule_type": "protein",
        "fasta": fasta,
        "authors": [
            {
                "full_name": "Test Author",
                "orcid": "0000-0002-1825-0097",
                "affiliation": "Test Lab",
                "is_corresponding": True,
            }
        ],
        "design": {
            "generating_model": "RFdiffusion",
            "model_version": "1.1",
            "design_method": "backbone generation, then sequence design",
            "design_target": TARGET,
            "n_designed": 100,
            "n_tested": 12,
            "n_functional": 3,
            "assays": ["binding"],
            "expression_host": "E. coli",
            "wet_lab_validated": True,
        },
        "data_license": "CC-BY-4.0",
        "submitter": {"name": "Test Submitter", "email": EMAIL},
        "confirms_rights": True,
        "accepts_screening": True,
    }
    payload.update(over)
    return payload


def _force(monkeypatch, outcome: str) -> None:
    report = (
        {"gate2": {"status": "FAIL", "message": "fixed by the test"}}
        if outcome == "withheld"
        else {}
    )

    async def fixed(db, prepared, host_organism, env):
        return ScreenResult(outcome, report)

    monkeypatch.setattr("sentinel_api.routes.submissions.screen", fixed)


async def _submit(client: AsyncClient, monkeypatch, outcome: str, **over) -> str:
    _force(monkeypatch, outcome)
    response = await client.post("/api/v1/submissions", json=_payload(**over))
    assert response.status_code == 202, response.text
    return response.json()["registry_id"]


async def _publish(client: AsyncClient, registry_id: str, headers: dict) -> None:
    for status in ("staged", "reviewed", "published"):
        response = await client.post(
            f"/api/v1/catalogue/{registry_id}/status", json={"status": status}, headers=headers
        )
        assert response.status_code == 200, response.text


@pytest.fixture
def session(db_engine):
    return async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)


class TestReceipt:
    async def test_passing_submission_gets_an_ag_accession(self, client, licences, monkeypatch):
        assert (await _submit(client, monkeypatch, "passed")).startswith("AG-")

    async def test_receipt_does_not_reveal_the_outcome(self, client, licences, monkeypatch):
        """An answer that differed by outcome would be a screening oracle."""
        _force(monkeypatch, "passed")
        passed = (await client.post("/api/v1/submissions", json=_payload(FASTA_OK))).json()
        _force(monkeypatch, "withheld")
        held = (await client.post("/api/v1/submissions", json=_payload(FASTA_OK2))).json()
        passed.pop("registry_id")
        held.pop("registry_id")
        assert passed == held

    async def test_honeypot_issues_nothing(self, client, licences, monkeypatch, session):
        _force(monkeypatch, "passed")
        response = await client.post("/api/v1/submissions", json=_payload(website="spam.example"))
        assert response.status_code == 202
        assert response.json()["registry_id"] is None
        async with session() as s:
            assert (await s.execute(select(func.count()).select_from(Record))).scalar_one() == 0

    @pytest.mark.parametrize(
        ("override", "code"),
        [
            ({"confirms_rights": False}, "CONFIRMATION_REQUIRED"),
            ({"accepts_screening": False}, "CONFIRMATION_REQUIRED"),
            ({"molecule_type": "dna"}, "MOLECULE_TYPE_MISMATCH"),
            ({"molecule_type": "banana"}, "INVALID_MOLECULE_TYPE"),
            ({"data_license": "NOT-A-LICENCE"}, "UNKNOWN_LICENSE"),
            ({"submitter": {"name": "X", "email": "not an address"}}, "INVALID_EMAIL"),
        ],
    )
    async def test_refuses_bad_input(self, client, licences, monkeypatch, override, code):
        _force(monkeypatch, "passed")
        response = await client.post("/api/v1/submissions", json=_payload(**override))
        assert response.status_code == 422
        assert response.json()["detail"]["code"] == code

    async def test_the_same_sequence_twice_is_refused(self, client, licences, monkeypatch):
        await _submit(client, monkeypatch, "passed")
        response = await client.post("/api/v1/submissions", json=_payload())
        assert response.status_code == 409
        assert response.json()["detail"]["code"] == "SEQUENCE_ALREADY_IN_ARCHIVE"


class TestStorage:
    async def test_a_passed_sequence_is_stored_and_indexed(
        self, client, licences, monkeypatch, session
    ):
        rid = await _submit(client, monkeypatch, "passed")
        async with session() as s:
            blob = (
                await s.execute(select(SequenceBlob).where(SequenceBlob.record_id == rid))
            ).scalar_one()
            record = (
                await s.execute(select(CatalogueRecord).where(CatalogueRecord.id == rid))
            ).scalar_one()
            record_class = (
                await s.execute(select(Record.record_class).where(Record.id == rid))
            ).scalar_one()
            kmers = (
                await s.execute(
                    select(FragmentKmerIndex).where(FragmentKmerIndex.registry_id == rid)
                )
            ).scalars().all()
        assert blob.data is not None
        assert (record.status, record.visibility) == ("draft", "private")
        assert (record.biosafety_class, record.hosting_decision) == ("none", "hosted")
        assert record_class == "submission"
        assert kmers and all(k.org_id is None for k in kmers)

    async def test_a_withheld_sequence_is_never_stored(
        self, client, licences, monkeypatch, session
    ):
        rid = await _submit(client, monkeypatch, "withheld")
        async with session() as s:
            blob = (
                await s.execute(select(SequenceBlob).where(SequenceBlob.record_id == rid))
            ).scalar_one()
            record = (
                await s.execute(select(CatalogueRecord).where(CatalogueRecord.id == rid))
            ).scalar_one()
            kmers = (
                await s.execute(
                    select(func.count())
                    .select_from(FragmentKmerIndex)
                    .where(FragmentKmerIndex.registry_id == rid)
                )
            ).scalar_one()
            outcome = (
                await s.execute(
                    select(Submission.screening_outcome).where(Submission.record_id == rid)
                )
            ).scalar_one()
        assert blob.data is None
        assert blob.length > 0 and len(blob.sha3_256) == 64
        assert (record.biosafety_class, record.hosting_decision) == ("restricted", "withheld")
        assert kmers == 0
        assert outcome == "withheld"

    async def test_a_restrictive_licence_keeps_metadata_only(
        self, client, licences, monkeypatch, session
    ):
        rid = await _submit(client, monkeypatch, "passed", data_license="CC-BY-NC-ND-4.0")
        async with session() as s:
            blob = (
                await s.execute(select(SequenceBlob).where(SequenceBlob.record_id == rid))
            ).scalar_one()
            decision = (
                await s.execute(
                    select(CatalogueRecord.hosting_decision).where(CatalogueRecord.id == rid)
                )
            ).scalar_one()
        assert blob.data is None
        assert decision == "metadata_only"

    async def test_every_submission_enters_the_ledger(
        self, client, licences, monkeypatch, session
    ):
        first = await _submit(client, monkeypatch, "passed")
        second = await _submit(client, monkeypatch, "withheld", fasta=FASTA_OK2)
        async with session() as s:
            entries = (
                await s.execute(select(RegistryAuditLog).order_by(RegistryAuditLog.seq_num))
            ).scalars().all()
        assert [e.registry_id for e in entries] == [first, second]
        assert entries[1].prev_hash_hex == entries[0].entry_hash_hex


class TestOutbox:
    async def test_a_withheld_submission_drafts_a_letter(
        self, client, licences, scoped_keys, monkeypatch
    ):
        rid = await _submit(client, monkeypatch, "withheld")
        response = await client.get("/api/v1/submissions/outbox", headers=scoped_keys["agent"])
        assert response.status_code == 200
        [letter] = [x for x in response.json() if x["record_id"] == rid]
        assert letter["recipient_email"] == EMAIL
        assert letter["status"] == "drafted"
        assert rid in letter["body"]
        assert "gate2" not in letter["body"]
        assert "fixed by the test" not in letter["body"]

    async def test_a_passing_submission_drafts_nothing(
        self, client, licences, monkeypatch, session
    ):
        rid = await _submit(client, monkeypatch, "passed")
        async with session() as s:
            count = (
                await s.execute(
                    select(func.count())
                    .select_from(Notification)
                    .where(Notification.record_id == rid)
                )
            ).scalar_one()
        assert count == 0

    async def test_a_suppressed_recipient_is_held_back(
        self, client, licences, monkeypatch, session
    ):
        async with session() as s:
            s.add(
                DoNotContact(email_hmac=email_fingerprint(EMAIL, pepper()), reason="requested")
            )
            await s.commit()
        rid = await _submit(client, monkeypatch, "withheld")
        async with session() as s:
            letter = (
                await s.execute(select(Notification).where(Notification.record_id == rid))
            ).scalar_one()
        assert letter.status == "suppressed"

    async def test_the_outbox_needs_the_draft_scope(self, client, scoped_keys):
        response = await client.get("/api/v1/submissions/outbox", headers=scoped_keys["plain"])
        assert response.status_code == 403

    async def test_a_letter_is_marked_sent_only_once(
        self, client, licences, scoped_keys, monkeypatch
    ):
        rid = await _submit(client, monkeypatch, "withheld")
        box = (
            await client.get("/api/v1/submissions/outbox", headers=scoped_keys["agent"])
        ).json()
        [letter] = [x for x in box if x["record_id"] == rid]
        url = f"/api/v1/submissions/outbox/{letter['id']}"
        sent = await client.post(url, json={"status": "sent"}, headers=scoped_keys["agent"])
        assert sent.status_code == 200
        assert sent.json()["sent_at"] is not None
        again = await client.post(url, json={"status": "sent"}, headers=scoped_keys["agent"])
        assert again.status_code == 409


class TestPublicView:
    async def test_a_withheld_record_hides_what_it_was_for(
        self, client, licences, scoped_keys, monkeypatch
    ):
        rid = await _submit(client, monkeypatch, "withheld")
        await _publish(client, rid, scoped_keys["operator"])
        body = (
            await client.get(f"/api/v1/catalogue/{rid}", headers=scoped_keys["plain"])
        ).json()
        assert body["record_kind"] == "submission"
        assert body["sequence"]["withheld"] and not body["sequence"]["held"]
        assert body["summary"] is None
        assert body["design"]["design_target"] is None
        assert body["design"]["assays"] == []
        assert body["design"]["generating_model"] == "RFdiffusion"
        assert not any(g["gate_key"].startswith("gate:") for g in body["gates"])
        assert not any(g["gate_family"] == "integrity" for g in body["gates"])

    async def test_a_reviewer_still_sees_the_detail(
        self, client, licences, scoped_keys, monkeypatch
    ):
        rid = await _submit(client, monkeypatch, "withheld")
        body = (
            await client.get(f"/api/v1/catalogue/{rid}", headers=scoped_keys["operator"])
        ).json()
        assert body["design"]["design_target"] == TARGET
        assert any(g["gate_key"].startswith("gate:") for g in body["gates"])

    async def test_search_does_not_reach_a_hidden_design_target(
        self, client, licences, scoped_keys, monkeypatch
    ):
        rid = await _submit(client, monkeypatch, "withheld")
        await _publish(client, rid, scoped_keys["operator"])
        headers = scoped_keys["plain"]
        hidden = await client.get("/api/v1/catalogue", params={"q": TARGET}, headers=headers)
        visible = await client.get("/api/v1/catalogue", params={"q": "binder"}, headers=headers)
        assert hidden.json()["count"] == 0
        assert visible.json()["count"] == 1

    async def test_a_draft_submission_is_invisible_to_the_public(
        self, client, licences, scoped_keys, monkeypatch
    ):
        rid = await _submit(client, monkeypatch, "passed")
        response = await client.get(f"/api/v1/catalogue/{rid}", headers=scoped_keys["plain"])
        assert response.status_code == 404
