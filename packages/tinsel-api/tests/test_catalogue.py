"""Catalogue ingest: scopes, the state machine, and the hosting decision.

The behaviour these pin down is the reason the catalogue exists as a separate
record class. In particular, the Genome Watch agent must be unable to publish:
it holds catalogue:draft and not catalogue:publish, and that is enforced per
request rather than trusted.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient


def payload(
    *,
    doi: str | None = "10.64898/2026.10.08.757794",
    data_license: str | None = "UNSTATED",
    article_license: str | None = "CC-BY-NC-ND-4.0",
    authors: bool = True,
    biosafety_class: str = "none",
    container: str | None = "bioRxiv",
    published_on: str | None = "2026-10-09",
) -> dict:
    """A realistic create body, modelled on the CheMoDesign record."""
    return {
        "title": "Designed proteins built around non-canonical chemistry",
        "molecule_type": "protein",
        "biosafety_class": biosafety_class,
        "source": {
            "title": "De novo protein design in an expanded chemical space",
            "url": "https://www.biorxiv.org/content/10.64898/2026.10.08.757794v1",
            "doi": doi,
            "container": container,
            "published_on": published_on,
            "peer_reviewed": False,
            "version": "v1",
            "article_license": article_license,
            "data_license": data_license,
            "authors": (
                [
                    {"full_name": "Yuxuan Li", "affiliation": "Peking University"},
                    {
                        "full_name": "Tao Liu",
                        "affiliation": "Peking University",
                        "is_corresponding": True,
                    },
                ]
                if authors
                else []
            ),
        },
        "design": {
            "generating_model": "CheMoDesign over Boltz-2",
            "design_target": "binders around a non-canonical chemical group",
            "n_tested": 75,
            "n_functional": 29,
            "assays": ["expression", "binding", "activity"],
            "wet_lab_validated": True,
        },
        "accessions": [],
        "gate_answers": [
            {"gate_family": "editorial", "gate_key": "3", "outcome": "pass",
             "detail": "Seven wet-lab campaigns, measured by BLI."},
        ],
    }


async def _create(client: AsyncClient, headers: dict, body: dict | None = None):
    return await client.post(
        "/api/v1/catalogue", json=body or payload(), headers=headers
    )


class TestCreate:
    async def test_lands_in_draft_with_an_agc_accession(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        resp = await _create(client, scoped_keys["agent"])
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["registry_id"].startswith("AGC-")
        assert body["status"] == "draft"
        assert body["visibility"] == "private"

    async def test_requires_the_draft_scope(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        """A read-only key may not create a record."""
        resp = await _create(client, scoped_keys["plain"])
        assert resp.status_code == 403
        assert "catalogue:draft" in resp.json()["detail"]["missing_scopes"]

    async def test_unstated_licence_yields_metadata_only(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        """UNSTATED resolves as unstated, not as a restrictive licence.

        The distinction matters: a restrictive licence is settled, because the
        authors already answered. An unstated one is a question nobody has
        asked, and only the second opens an enquiry.
        """
        resp = await _create(client, scoped_keys["agent"])
        body = resp.json()
        assert body["hosting_decision"] == "metadata_only"
        assert body["license_resolution"] == "unstated"
        assert "not a permissive one" in body["hosting_reason"]

    async def test_restrictive_licence_is_settled_and_asks_nobody(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        """A licence that forbids redistribution opens no enquiry."""
        resp = await _create(
            client, scoped_keys["agent"], payload(data_license="CC-BY-NC-ND-4.0")
        )
        body = resp.json()
        assert body["hosting_decision"] == "metadata_only"
        assert body["license_resolution"] == "stated_restrictive"
        assert "does not permit redistribution" in body["hosting_reason"]
        assert not any(g["gate_key"] == "enquiry" for g in body["gates"])

    async def test_absent_licence_also_yields_metadata_only(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        """A paper that states nothing at all takes the other branch.

        Worth covering separately: "no licence field" and "a licence row saying
        no" reach the same decision by different paths, and only one of them
        would be caught by a typo in the vocabulary.
        """
        resp = await _create(client, scoped_keys["agent"], payload(data_license=None))
        body = resp.json()
        assert body["hosting_decision"] == "metadata_only"
        assert "not a permissive one" in body["hosting_reason"]

    async def test_permissive_licence_yields_hosted(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        resp = await _create(
            client, scoped_keys["agent"], payload(data_license="CC-BY-4.0")
        )
        assert resp.json()["hosting_decision"] == "hosted"

    async def test_restricted_biosafety_withholds_whatever_the_licence(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        resp = await _create(
            client,
            scoped_keys["agent"],
            payload(data_license="CC-BY-4.0", biosafety_class="restricted"),
        )
        body = resp.json()
        assert body["hosting_decision"] == "withheld"

    async def test_unknown_licence_is_refused(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        """A typo must not quietly become a hosting decision."""
        resp = await _create(
            client, scoped_keys["agent"], payload(data_license="CC-BY-9.9")
        )
        assert resp.status_code == 422
        assert resp.json()["detail"]["code"] == "UNKNOWN_LICENSE"
        assert "UNSTATED" in resp.json()["detail"]["known_licenses"]

    async def test_duplicate_doi_returns_the_existing_accession(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        first = await _create(client, scoped_keys["agent"])
        again = await _create(client, scoped_keys["agent"])
        assert again.status_code == 409
        detail = again.json()["detail"]
        assert detail["code"] == "ALREADY_CATALOGUED"
        assert detail["registry_id"] == first.json()["registry_id"]

    async def test_gate_answers_are_recorded(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        resp = await _create(client, scoped_keys["agent"])
        families = {g["gate_family"] for g in resp.json()["gates"]}
        assert {"attribution", "license", "editorial"} <= families


class TestStateMachine:
    async def _staged(self, client: AsyncClient, headers: dict) -> str:
        created = await _create(client, headers)
        registry_id = created.json()["registry_id"]
        resp = await client.post(
            f"/api/v1/catalogue/{registry_id}/status",
            json={"status": "staged"},
            headers=headers,
        )
        assert resp.status_code == 200, resp.text
        return registry_id

    async def test_draft_cannot_jump_straight_to_published(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        created = await _create(client, scoped_keys["operator"])
        registry_id = created.json()["registry_id"]
        resp = await client.post(
            f"/api/v1/catalogue/{registry_id}/status",
            json={"status": "published"},
            headers=scoped_keys["operator"],
        )
        assert resp.status_code == 409
        assert resp.json()["detail"]["code"] == "INVALID_TRANSITION"

    async def test_the_agent_cannot_publish(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        """The editorial control: drafting and publishing are different scopes."""
        registry_id = await self._staged(client, scoped_keys["agent"])
        await client.post(
            f"/api/v1/catalogue/{registry_id}/status",
            json={"status": "reviewed"},
            headers=scoped_keys["agent"],
        )
        resp = await client.post(
            f"/api/v1/catalogue/{registry_id}/status",
            json={"status": "published"},
            headers=scoped_keys["agent"],
        )
        assert resp.status_code == 403
        assert resp.json()["detail"]["missing_scopes"] == ["catalogue:publish"]

    async def test_an_operator_can_publish(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        registry_id = await self._staged(client, scoped_keys["operator"])
        await client.post(
            f"/api/v1/catalogue/{registry_id}/status",
            json={"status": "reviewed"},
            headers=scoped_keys["operator"],
        )
        resp = await client.post(
            f"/api/v1/catalogue/{registry_id}/status",
            json={"status": "published", "reason": "Reviewed and edited."},
            headers=scoped_keys["operator"],
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "published"
        assert resp.json()["visibility"] == "public"

    async def test_attribution_failure_blocks_staging(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        """A record that cannot credit its authors stays in draft."""
        created = await _create(
            client, scoped_keys["operator"], payload(authors=False)
        )
        assert created.status_code == 201
        assert any(
            g["gate_family"] == "attribution" and g["outcome"] == "fail"
            for g in created.json()["gates"]
        )
        resp = await client.post(
            f"/api/v1/catalogue/{created.json()['registry_id']}/status",
            json={"status": "staged"},
            headers=scoped_keys["operator"],
        )
        assert resp.status_code == 409
        assert resp.json()["detail"]["code"] == "ATTRIBUTION_INCOMPLETE"

    async def test_withdrawn_is_terminal(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        created = await _create(client, scoped_keys["operator"])
        registry_id = created.json()["registry_id"]
        withdraw = await client.post(
            f"/api/v1/catalogue/{registry_id}/status",
            json={"status": "withdrawn", "reason": "Author objected."},
            headers=scoped_keys["operator"],
        )
        assert withdraw.status_code == 200
        resp = await client.post(
            f"/api/v1/catalogue/{registry_id}/status",
            json={"status": "staged"},
            headers=scoped_keys["operator"],
        )
        assert resp.status_code == 409
        assert resp.json()["detail"]["allowed"] == []

    async def test_transitions_are_recorded(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        registry_id = await self._staged(client, scoped_keys["operator"])
        resp = await client.get(
            f"/api/v1/catalogue/{registry_id}", headers=scoped_keys["operator"]
        )
        keys = {g["gate_key"] for g in resp.json()["gates"]}
        assert "transition:draft->staged" in keys


class TestVisibility:
    async def test_unpublished_is_hidden_from_a_public_read_key(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        created = await _create(client, scoped_keys["agent"])
        registry_id = created.json()["registry_id"]
        resp = await client.get(
            f"/api/v1/catalogue/{registry_id}", headers=scoped_keys["plain"]
        )
        # 404 rather than 403, so the response does not confirm it exists.
        assert resp.status_code == 404

    async def test_published_is_visible_to_any_key(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        created = await _create(client, scoped_keys["operator"])
        registry_id = created.json()["registry_id"]
        for target in ("staged", "reviewed", "published"):
            resp = await client.post(
                f"/api/v1/catalogue/{registry_id}/status",
                json={"status": target},
                headers=scoped_keys["operator"],
            )
            assert resp.status_code == 200, resp.text
        resp = await client.get(
            f"/api/v1/catalogue/{registry_id}", headers=scoped_keys["plain"]
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "published"

    async def test_list_hides_unpublished_from_a_public_read_key(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        await _create(client, scoped_keys["agent"])
        plain = await client.get("/api/v1/catalogue", headers=scoped_keys["plain"])
        assert plain.status_code == 200
        assert plain.json()["count"] == 0
        agent = await client.get("/api/v1/catalogue", headers=scoped_keys["agent"])
        assert agent.json()["count"] == 1

    @pytest.mark.parametrize("bad_status", ["banana", "APPROVED"])
    async def test_list_rejects_an_unknown_status_filter(
        self, client: AsyncClient, scoped_keys, licences, bad_status: str
    ) -> None:
        resp = await client.get(
            f"/api/v1/catalogue?status={bad_status}", headers=scoped_keys["agent"]
        )
        assert resp.status_code == 422
