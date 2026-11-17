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


class TestClassification:
    """What a record does and what it acts on.

    These are the two fields the browse page groups by, so the behaviour that
    matters is that a wrong value is refused loudly rather than stored, and
    that an unclassified record stays usable.
    """

    async def test_a_record_starts_unclassified(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        """Neither field is required to create a record, and absence is null."""
        resp = await _create(client, scoped_keys["agent"])
        assert resp.status_code == 201, resp.text
        assert resp.json()["function_class"] is None
        assert resp.json()["subject_class"] is None

    async def test_classes_can_be_set_at_ingest(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        body = payload()
        body["function_class"] = "binder"
        body["subject_class"] = "soluble_protein"
        resp = await _create(client, scoped_keys["agent"], body)
        assert resp.status_code == 201, resp.text
        assert resp.json()["function_class"] == "binder"
        assert resp.json()["subject_class"] == "soluble_protein"

    @pytest.mark.parametrize(
        ("field", "value"),
        [
            ("function_class", "inhibitor"),
            ("function_class", "Binder"),
            ("subject_class", "virus"),
            ("subject_class", "soluble-protein"),
        ],
    )
    async def test_an_unknown_class_is_refused_at_ingest(
        self, client: AsyncClient, scoped_keys, licences, field: str, value: str
    ) -> None:
        """Including near-misses: the wrong case, and the file's kebab spelling."""
        body = payload()
        body[field] = value
        resp = await _create(client, scoped_keys["agent"], body)
        assert resp.status_code == 422, resp.text

    async def test_classification_can_be_set_and_revised_after_ingest(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        """Assigning these is a reading of the paper, so it happens later."""
        created = await _create(client, scoped_keys["agent"])
        registry_id = created.json()["registry_id"]

        first = await client.put(
            f"/api/v1/catalogue/{registry_id}/classification",
            json={"function_class": "binder", "subject_class": "virion"},
            headers=scoped_keys["agent"],
        )
        assert first.status_code == 200, first.text
        assert first.json()["function_class"] == "binder"
        assert first.json()["subject_class"] == "virion"

        revised = await client.put(
            f"/api/v1/catalogue/{registry_id}/classification",
            json={"function_class": "sensor", "subject_class": None},
            headers=scoped_keys["agent"],
        )
        assert revised.status_code == 200, revised.text
        assert revised.json()["function_class"] == "sensor"
        assert revised.json()["subject_class"] is None

    async def test_classifying_requires_the_draft_scope(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        created = await _create(client, scoped_keys["agent"])
        registry_id = created.json()["registry_id"]
        resp = await client.put(
            f"/api/v1/catalogue/{registry_id}/classification",
            json={"function_class": "binder"},
            headers=scoped_keys["plain"],
        )
        assert resp.status_code == 403

    async def test_classifying_an_unknown_record_is_a_404(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        resp = await client.put(
            "/api/v1/catalogue/AGC-2026-999999/classification",
            json={"function_class": "binder"},
            headers=scoped_keys["agent"],
        )
        assert resp.status_code == 404

    async def test_list_filters_by_function_and_subject(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        binder = payload()
        binder["function_class"] = "binder"
        binder["subject_class"] = "virion"
        await _create(client, scoped_keys["agent"], binder)

        sensor = payload(doi="10.64898/2026.10.08.757795")
        sensor["function_class"] = "sensor"
        await _create(client, scoped_keys["agent"], sensor)

        both = await client.get("/api/v1/catalogue", headers=scoped_keys["agent"])
        assert both.json()["count"] == 2

        only_binders = await client.get(
            "/api/v1/catalogue?function_class=binder", headers=scoped_keys["agent"]
        )
        assert only_binders.json()["count"] == 1
        assert only_binders.json()["items"][0]["function_class"] == "binder"

        by_subject = await client.get(
            "/api/v1/catalogue?subject_class=virion", headers=scoped_keys["agent"]
        )
        assert by_subject.json()["count"] == 1

        unused = await client.get(
            "/api/v1/catalogue?subject_class=nanoparticle", headers=scoped_keys["agent"]
        )
        assert unused.json()["count"] == 0

    @pytest.mark.parametrize(
        "query",
        ["function_class=inhibitor", "subject_class=virus", "function_class=Binder"],
    )
    async def test_list_rejects_an_unknown_class_filter(
        self, client: AsyncClient, scoped_keys, licences, query: str
    ) -> None:
        """Silently returning nothing would read as 'the archive holds none'."""
        resp = await client.get(
            f"/api/v1/catalogue?{query}", headers=scoped_keys["agent"]
        )
        assert resp.status_code == 422

    async def test_a_method_paper_can_say_so(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        """`method` exists because two of the first twenty records needed it.

        RFdiffusion and LigandMPNN each produce binders, scaffolds, sensors and
        enzymes alike, so every other value would have been a claim the paper
        does not make. A method is aimed at no single target, so the subject
        stays empty beside it.
        """
        body = payload()
        body["function_class"] = "method"
        resp = await _create(client, scoped_keys["agent"], body)
        assert resp.status_code == 201, resp.text
        assert resp.json()["function_class"] == "method"
        assert resp.json()["subject_class"] is None

        listed = await client.get(
            "/api/v1/catalogue?function_class=method", headers=scoped_keys["agent"]
        )
        assert listed.json()["count"] == 1


class TestSummaries:
    """The two summaries a record page shows.

    `summary` is the plain-words one and has been since 016; 019 adds
    `technical_summary` beside it, in the paper's own vocabulary. The point of
    the pair is that neither audience is served by watering down what the
    other one reads, so either may be present without the other.
    """

    async def test_a_record_may_start_with_neither(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        resp = await _create(client, scoped_keys["agent"])
        assert resp.status_code == 201, resp.text
        assert resp.json()["summary"] is None
        assert resp.json()["technical_summary"] is None

    async def test_both_can_be_written_after_ingest_and_revised(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        created = await _create(client, scoped_keys["agent"])
        registry_id = created.json()["registry_id"]

        written = await client.put(
            f"/api/v1/catalogue/{registry_id}/summaries",
            json={
                "summary": "They built a gripper for one chosen spot.",
                "technical_summary": "De novo VHHs against a specified epitope.",
            },
            headers=scoped_keys["agent"],
        )
        assert written.status_code == 200, written.text
        assert written.json()["summary"].startswith("They built")
        assert written.json()["technical_summary"].startswith("De novo")

        # One without the other is a real state, not half-finished work.
        revised = await client.put(
            f"/api/v1/catalogue/{registry_id}/summaries",
            json={"summary": "They built a gripper for one chosen spot."},
            headers=scoped_keys["agent"],
        )
        assert revised.status_code == 200, revised.text
        assert revised.json()["technical_summary"] is None

    async def test_writing_summaries_requires_the_draft_scope(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        created = await _create(client, scoped_keys["agent"])
        registry_id = created.json()["registry_id"]
        resp = await client.put(
            f"/api/v1/catalogue/{registry_id}/summaries",
            json={"summary": "..."},
            headers=scoped_keys["plain"],
        )
        assert resp.status_code == 403

    async def test_summaries_survive_a_read_back(
        self, client: AsyncClient, scoped_keys, licences
    ) -> None:
        """The record page reads them from GET, not from the write response."""
        body = payload()
        body["summary"] = "Plain words."
        body["technical_summary"] = "The paper's words."
        created = await _create(client, scoped_keys["agent"], body)
        registry_id = created.json()["registry_id"]

        fetched = await client.get(
            f"/api/v1/catalogue/{registry_id}", headers=scoped_keys["agent"]
        )
        assert fetched.status_code == 200
        assert fetched.json()["summary"] == "Plain words."
        assert fetched.json()["technical_summary"] == "The paper's words."
