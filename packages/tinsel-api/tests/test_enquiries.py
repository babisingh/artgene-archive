"""The licence enquiry queue: who is asked, who is not, and what follows.

The behaviour here is the archive asking permission rather than assuming it.
The rules worth pinning down are that hazardous work is never asked about, that
a settled licence is not re-litigated, that one reminder is the limit, and that
declining costs the authors nothing but costs the index nothing either.
"""

from __future__ import annotations

from httpx import AsyncClient

from tests.test_catalogue import payload


def with_orcid(orcid: str, **kwargs) -> dict:
    """A payload whose corresponding author has a known ORCID."""
    body = payload(**kwargs)
    body["source"]["authors"][1]["orcid"] = orcid
    return body


async def _create(client: AsyncClient, headers: dict, body: dict | None = None):
    return await client.post("/api/v1/catalogue", json=body or payload(), headers=headers)


async def _queue(client: AsyncClient, admin: dict) -> list[dict]:
    resp = await client.get("/api/v1/enquiries", headers=admin)
    assert resp.status_code == 200, resp.text
    return resp.json()["items"]


class TestWhoGetsAsked:
    async def test_unstated_licence_queues_an_enquiry(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        await _create(client, scoped_keys["agent"])
        items = await _queue(client, scoped_keys["admin"])
        assert len(items) == 1
        assert items[0]["reason"] == "unstated"
        assert items[0]["status"] == "queued"
        assert items[0]["contact_name"] == "Tao Liu"

    async def test_the_agent_cannot_read_the_queue(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        """It creates the enquiries and may not see the contact details."""
        await _create(client, scoped_keys["agent"])
        resp = await client.get("/api/v1/enquiries", headers=scoped_keys["agent"])
        assert resp.status_code == 403
        assert resp.json()["detail"]["missing_scopes"] == ["admin"]

    async def test_a_settled_licence_is_not_re_litigated(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        """The authors already answered, in their licence."""
        await _create(
            client, scoped_keys["agent"], payload(data_license="CC-BY-NC-ND-4.0")
        )
        assert await _queue(client, scoped_keys["admin"]) == []

    async def test_hazardous_work_is_never_asked_about(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        """Asking a lab for a hazardous sequence is the wrong letter to send."""
        await _create(
            client,
            scoped_keys["agent"],
            payload(data_license="UNSTATED", biosafety_class="elevated"),
        )
        assert await _queue(client, scoped_keys["admin"]) == []

    async def test_permissive_licence_with_nothing_deposited_asks_where_it_is(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        await _create(
            client, scoped_keys["agent"], payload(data_license="CC-BY-4.0")
        )
        items = await _queue(client, scoped_keys["admin"])
        assert len(items) == 1
        assert items[0]["reason"] == "no_data_deposited"

    async def test_permissive_licence_with_a_deposit_asks_nothing(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        body = payload(data_license="CC-BY-4.0")
        body["accessions"] = [
            {"database": "pdb", "accession": "7M5T", "url": "https://rcsb.org/7M5T"}
        ]
        await _create(client, scoped_keys["agent"], body)
        assert await _queue(client, scoped_keys["admin"]) == []


class TestTheLetter:
    async def test_it_names_the_record_and_offers_to_decline(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        created = await _create(client, scoped_keys["agent"])
        enquiry = (await _queue(client, scoped_keys["admin"]))[0]
        resp = await client.get(
            f"/api/v1/enquiries/{enquiry['id']}/letter?sender=Dr%20B%20Singh",
            headers=scoped_keys["admin"],
        )
        assert resp.status_code == 200, resp.text
        letter = resp.json()["letter"]
        assert created.json()["registry_id"] in letter
        assert "Tao Liu" in letter
        assert "reduced to a plain citation" in letter
        assert "Dr B Singh" in letter
        # The reply states plainly that nothing was sent.
        assert "sends nothing" in resp.json()["note"]

    async def test_a_missing_deposit_changes_the_question(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        await _create(client, scoped_keys["agent"], payload(data_license="CC-BY-4.0"))
        enquiry = (await _queue(client, scoped_keys["admin"]))[0]
        resp = await client.get(
            f"/api/v1/enquiries/{enquiry['id']}/letter", headers=scoped_keys["admin"]
        )
        assert "deposited anywhere we should link to" in resp.json()["letter"]


class TestWorkingTheQueue:
    async def _enquiry_id(self, client: AsyncClient, scoped_keys) -> str:
        await _create(client, scoped_keys["agent"])
        return (await _queue(client, scoped_keys["admin"]))[0]["id"]

    async def _advance(self, client, scoped_keys, enquiry_id, status, **extra):
        return await client.post(
            f"/api/v1/enquiries/{enquiry_id}/status",
            json={"status": status, **extra},
            headers=scoped_keys["admin"],
        )

    async def test_one_reminder_then_stop(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        enquiry_id = await self._enquiry_id(client, scoped_keys)
        for status in ("drafted", "sent", "reminded"):
            resp = await self._advance(client, scoped_keys, enquiry_id, status)
            assert resp.status_code == 200, resp.text
        again = await self._advance(client, scoped_keys, enquiry_id, "reminded")
        assert again.status_code == 409
        assert "reminded" not in again.json()["detail"]["allowed"]

    async def test_closing_purges_the_address(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        """Held to write the letter, and not kept afterwards."""
        enquiry_id = await self._enquiry_id(client, scoped_keys)
        await self._advance(client, scoped_keys, enquiry_id, "drafted")
        sent = await self._advance(
            client, scoped_keys, enquiry_id, "sent", contact_email="tao@example.edu"
        )
        assert sent.json()["has_contact_email"] is True
        closed = await self._advance(client, scoped_keys, enquiry_id, "closed")
        assert closed.json()["has_contact_email"] is False
        # Name and ORCID stay: attribution needs them regardless.
        assert closed.json()["contact_name"] == "Tao Liu"

    async def test_a_reply_cannot_be_recorded_before_the_letter_is_sent(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        enquiry_id = await self._enquiry_id(client, scoped_keys)
        resp = await client.post(
            f"/api/v1/enquiries/{enquiry_id}/response",
            json={"evidence": "a hallway conversation"},
            headers=scoped_keys["admin"],
        )
        assert resp.status_code == 409
        assert resp.json()["detail"]["code"] == "NOT_AWAITING_REPLY"


class TestResponses:
    async def _sent(self, client: AsyncClient, scoped_keys, body=None) -> tuple[str, str]:
        created = await _create(client, scoped_keys["agent"], body)
        registry_id = created.json()["registry_id"]
        enquiry_id = (await _queue(client, scoped_keys["admin"]))[0]["id"]
        for status in ("drafted", "sent"):
            resp = await client.post(
                f"/api/v1/enquiries/{enquiry_id}/status",
                json={"status": status, "contact_email": "tao@example.edu"},
                headers=scoped_keys["admin"],
            )
            assert resp.status_code == 200, resp.text
        return registry_id, enquiry_id

    async def test_a_confirmed_licence_unlocks_hosting(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        registry_id, enquiry_id = await self._sent(client, scoped_keys)
        resp = await client.post(
            f"/api/v1/enquiries/{enquiry_id}/response",
            json={
                "response_license": "CC-BY-4.0",
                "opt_in": True,
                "evidence": "email of 2026-11-20, quoted verbatim",
            },
            headers=scoped_keys["admin"],
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["opt_in"] is True

        record = await client.get(
            f"/api/v1/catalogue/{registry_id}", headers=scoped_keys["admin"]
        )
        body = record.json()
        assert body["license_resolution"] == "author_confirmed"
        assert body["hosting_decision"] == "hosted"
        # Every hosted byte traces to a statement by a person.
        assert "email of 2026-11-20" in body["hosting_reason"]

    async def test_declining_reduces_the_record_to_a_citation(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        registry_id, enquiry_id = await self._sent(client, scoped_keys)
        resp = await client.post(
            f"/api/v1/enquiries/{enquiry_id}/response",
            json={"declined": True, "evidence": "reply of 2026-11-21, declined"},
            headers=scoped_keys["admin"],
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["opt_in"] is False

        record = await client.get(
            f"/api/v1/catalogue/{registry_id}", headers=scoped_keys["admin"]
        )
        body = record.json()
        assert body["license_resolution"] == "author_declined"
        assert body["citation_only"] is True
        assert body["hosting_decision"] == "withheld"
        # The record survives: declining costs them no credit and costs the
        # index no coverage.
        assert body["status"] != "withdrawn"

    async def test_declining_suppresses_future_enquiries(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        orcid = "0000-0002-1825-0097"
        _, enquiry_id = await self._sent(
            client, scoped_keys, with_orcid(orcid)
        )
        await client.post(
            f"/api/v1/enquiries/{enquiry_id}/response",
            json={"declined": True, "evidence": "declined by email"},
            headers=scoped_keys["admin"],
        )

        # A second paper by the same corresponding author must not be asked.
        second = with_orcid(orcid, doi="10.1234/second.paper")
        await _create(client, scoped_keys["agent"], second)
        reasons = [
            e["reason"]
            for e in await _queue(client, scoped_keys["admin"])
            if e["id"] != enquiry_id
        ]
        assert reasons == []

    async def test_an_unknown_response_licence_is_refused(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        _, enquiry_id = await self._sent(client, scoped_keys)
        resp = await client.post(
            f"/api/v1/enquiries/{enquiry_id}/response",
            json={"response_license": "CC-BY-WHATEVER", "evidence": "email"},
            headers=scoped_keys["admin"],
        )
        assert resp.status_code == 422
        assert resp.json()["detail"]["code"] == "UNKNOWN_LICENSE"
