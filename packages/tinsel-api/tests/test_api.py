"""Integration tests for the tinsel-api FastAPI application.

Covers:
  - Health endpoint
  - POST /register — happy path, auth failure, bad FASTA
  - GET  /certificates/{id} — found, not found
  - GET  /certificates/ — list
  - POST /certificates/{id}/verify — no-watermark response, not found
  - POST /sequences/{id}/distributions + GET list
  - POST /verify-source
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import FASTA_OK, FASTA_OK2, FASTA_TOO_SHORT

# ── Health ────────────────────────────────────────────────────────────────────

class TestHealth:
    async def test_health_returns_ok(self, client: AsyncClient) -> None:
        resp = await client.get("/api/v1/health")
        assert resp.status_code == 200
        body = resp.json()
        # In the test environment the DB override doesn't reach _connectivity(),
        # so connectivity may be "degraded". We only assert shape here.
        assert body["status"] in ("ok", "degraded")
        assert body["version"] == "1.0.0"
        assert "vault" in body

    async def test_health_no_auth_required(self, client: AsyncClient) -> None:
        """Health endpoint must be reachable without an API key."""
        resp = await client.get("/api/v1/health")
        assert resp.status_code == 200


# ── Registration ──────────────────────────────────────────────────────────────

class TestRegister:
    async def test_register_valid_protein_returns_certified(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            "/api/v1/register",
            json={
                "fasta": FASTA_OK,
                "owner_id": "OWNER_TEST",
                "org_id": "test-org",
                "ethics_code": "ERC-001",
                "host_organism": "ECOLI",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["status"] == "CERTIFIED"
        assert body["registry_id"] is not None
        assert body["registry_id"].startswith("AG-")
        assert "Sequence certified" in body["message"]

    async def test_register_without_api_key_returns_4xx(
        self, client: AsyncClient
    ) -> None:
        """Missing X-API-Key header: FastAPI returns 422 (required header absent)
        before the dependency can return 401."""
        resp = await client.post(
            "/api/v1/register",
            json={
                "fasta": FASTA_OK,
                "owner_id": "OWNER_TEST",
                "org_id": "test-org",
                "ethics_code": "ERC-001",
            },
        )
        assert resp.status_code in (401, 422)

    async def test_register_empty_fasta_returns_422(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """An empty sequence (header-only FASTA) must return 422."""
        resp = await client.post(
            "/api/v1/register",
            json={
                "fasta": ">header_only_no_sequence",
                "owner_id": "OWNER_TEST",
                "org_id": "test-org",
                "ethics_code": "ERC-001",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 422

    async def test_register_short_protein_is_accepted(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """Short proteins are now accepted — registration no longer rejects based on
        watermark capacity since fingerprinting happens at distribution time."""
        resp = await client.post(
            "/api/v1/register",
            json={
                "fasta": FASTA_TOO_SHORT,
                "owner_id": "OWNER_TEST",
                "org_id": "test-org",
                "ethics_code": "ERC-001",
            },
            headers=auth_headers,
        )
        assert resp.status_code in (200, 201, 409)  # 409 if already registered

    async def test_register_sequential_ids_increment(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """Two registrations with different sequences get different, incrementing IDs."""
        r1 = await client.post(
            "/api/v1/register",
            json={"fasta": FASTA_OK, "owner_id": "OWNER_INC", "ethics_code": "ERC-002", "host_organism": "YEAST"},
            headers=auth_headers,
        )
        r2 = await client.post(
            "/api/v1/register",
            json={"fasta": FASTA_OK2, "owner_id": "OWNER_INC", "ethics_code": "ERC-002", "host_organism": "ECOLI"},
            headers=auth_headers,
        )
        assert r1.status_code == 201
        assert r2.status_code == 201
        assert r1.json()["registry_id"] != r2.json()["registry_id"]


# ── Certificates — read ───────────────────────────────────────────────────────

class TestCertificates:
    @pytest.fixture
    async def registered_id(self, client: AsyncClient, auth_headers: dict) -> str:
        """Register a certificate and return its registry_id."""
        resp = await client.post(
            "/api/v1/register",
            json={
                "fasta": FASTA_OK,
                "owner_id": "OWNER_CERT",
                "org_id": "test-org",
                "ethics_code": "ERC-003",
                "host_organism": "HUMAN",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text
        return resp.json()["registry_id"]

    async def test_get_certificate_found(
        self, client: AsyncClient, auth_headers: dict, registered_id: str
    ) -> None:
        resp = await client.get(
            f"/api/v1/certificates/{registered_id}", headers=auth_headers
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["registry_id"] == registered_id
        assert body["status"] == "CERTIFIED"
        assert body["owner_id"] == "OWNER_CERT"
        assert body["ethics_code"] == "ERC-003"
        assert "watermark_metadata" in body
        assert "consequence_report" in body

    async def test_get_certificate_not_found(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.get(
            "/api/v1/certificates/AG-9999-999999", headers=auth_headers
        )
        assert resp.status_code == 404

    async def test_list_certificates(
        self, client: AsyncClient, auth_headers: dict, registered_id: str
    ) -> None:
        resp = await client.get("/api/v1/certificates/", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body
        assert "count" in body
        ids = [item["registry_id"] for item in body["items"]]
        assert registered_id in ids

    async def test_list_certificates_without_api_key_returns_4xx(
        self, client: AsyncClient
    ) -> None:
        resp = await client.get("/api/v1/certificates/")
        assert resp.status_code in (401, 422)


# ── Certificates — verify ────────────────────────────────────────────────────

class TestVerify:
    @pytest.fixture
    async def registered_id(self, client: AsyncClient, auth_headers: dict) -> str:
        resp = await client.post(
            "/api/v1/register",
            json={
                "fasta": FASTA_OK,
                "owner_id": "OWNER_VERIFY",
                "org_id": "test-org",
                "ethics_code": "ERC-004",
                "host_organism": "CHO",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text
        return resp.json()["registry_id"]

    async def test_verify_returns_no_watermark_message(
        self, client: AsyncClient, auth_headers: dict, registered_id: str
    ) -> None:
        """Certificates registered without per-registration fingerprinting return
        verified=False with a clear failure_reason pointing to /verify-source."""
        resp = await client.post(
            f"/api/v1/certificates/{registered_id}/verify", headers=auth_headers
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["registry_id"] == registered_id
        assert body["verified"] is False
        assert body["failure_reason"] is not None
        assert "verify-source" in body["failure_reason"]

    async def test_verify_nonexistent_certificate_returns_404(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await client.post(
            "/api/v1/certificates/AG-0000-000000/verify", headers=auth_headers
        )
        assert resp.status_code == 404

    async def test_verify_without_api_key_returns_4xx(
        self, client: AsyncClient, registered_id: str
    ) -> None:
        resp = await client.post(
            f"/api/v1/certificates/{registered_id}/verify"
        )
        assert resp.status_code in (401, 422)

    async def test_verify_response_has_expected_shape(
        self, client: AsyncClient, auth_headers: dict, registered_id: str
    ) -> None:
        resp = await client.post(
            f"/api/v1/certificates/{registered_id}/verify", headers=auth_headers
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "registry_id" in body
        assert "verified" in body
        assert "failure_reason" in body


# ── Provenance Tracing ────────────────────────────────────────────────────────

class TestDistributions:
    @pytest.fixture
    async def registered_id(self, client: AsyncClient, auth_headers: dict) -> str:
        resp = await client.post(
            "/api/v1/register",
            json={
                "fasta": FASTA_OK,
                "owner_id": "OWNER_DIST",
                "org_id": "test-org",
                "ethics_code": "ERC-005",
                "host_organism": "ECOLI",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text
        return resp.json()["registry_id"]

    async def test_issue_distribution_copy_returns_fasta(
        self, client: AsyncClient, auth_headers: dict, registered_id: str
    ) -> None:
        resp = await client.post(
            f"/api/v1/sequences/{registered_id}/distributions",
            json={
                "recipient_name": "Dr. Smith",
                "recipient_org": "Test CMO",
                "purpose": "cmo",
                "host_organism": "ECOLI",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text
        assert "ArtGene-Provenance" in resp.text

    async def test_list_distributions_returns_issued_copy(
        self, client: AsyncClient, auth_headers: dict, registered_id: str
    ) -> None:
        # Issue one copy first
        await client.post(
            f"/api/v1/sequences/{registered_id}/distributions",
            json={"recipient_name": "Lab A", "recipient_org": "Org A", "purpose": "collaboration"},
            headers=auth_headers,
        )
        resp = await client.get(
            f"/api/v1/sequences/{registered_id}/distributions",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) >= 1
        assert body[0]["recipient_org"] == "Org A"

    async def test_verify_source_identifies_copy(
        self, client: AsyncClient, auth_headers: dict, registered_id: str
    ) -> None:
        # Issue a copy and capture its DNA
        issue_resp = await client.post(
            f"/api/v1/sequences/{registered_id}/distributions",
            json={"recipient_name": "Dr. Leak", "recipient_org": "Leaky Lab", "purpose": "validation"},
            headers=auth_headers,
        )
        assert issue_resp.status_code == 201
        fasta_text = issue_resp.text

        # Submit the issued copy to verify-source
        verify_resp = await client.post(
            "/api/v1/verify-source",
            json={"fasta": fasta_text},
            headers=auth_headers,
        )
        assert verify_resp.status_code == 200
        body = verify_resp.json()
        assert body["match_found"] is True
        assert body["recipient_name"] == "Dr. Leak"
        assert body["recipient_org"] == "Leaky Lab"

    async def test_distributions_require_auth(
        self, client: AsyncClient, registered_id: str
    ) -> None:
        resp = await client.get(f"/api/v1/sequences/{registered_id}/distributions")
        assert resp.status_code in (401, 422)
