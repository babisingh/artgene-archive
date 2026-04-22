"""Integration tests for the tinsel-api FastAPI application.

Covers:
  - Health endpoint
  - POST /register — happy path, auth failure, bad FASTA
  - GET  /certificates/{id} — found, not found
  - GET  /certificates/ — list
  - POST /certificates/{id}/verify — v1.0 verify, legacy cert, not found
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from tests.conftest import FASTA_OK, FASTA_TOO_SHORT

# ── Health ────────────────────────────────────────────────────────────────────

class TestHealth:
    async def test_health_returns_ok(self, client: AsyncClient) -> None:
        resp = await client.get("/api/v1/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
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
        assert body["tier"] is not None
        assert body["chi_squared"] is not None
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

    async def test_register_too_short_protein_returns_failed(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """A protein too short to watermark returns body status=FAILED."""
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
        # The endpoint always uses the route-level 201; check the body for FAILED.
        assert resp.status_code in (200, 201)
        body = resp.json()
        assert body["status"] == "FAILED"
        assert "watermark" in (body["message"] or "").lower()

    async def test_register_sequential_ids_increment(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """Two successive registrations must get different, incrementing IDs."""
        payload = {
            "fasta": FASTA_OK,
            "owner_id": "OWNER_INC",
            "org_id": "test-org",
            "ethics_code": "ERC-002",
            "host_organism": "YEAST",
        }
        r1 = await client.post("/api/v1/register", json=payload, headers=auth_headers)
        r2 = await client.post("/api/v1/register", json=payload, headers=auth_headers)
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

    async def test_verify_v1_certificate_succeeds(
        self, client: AsyncClient, auth_headers: dict, registered_id: str
    ) -> None:
        """A freshly registered v1.0 certificate must verify as True."""
        resp = await client.post(
            f"/api/v1/certificates/{registered_id}/verify", headers=auth_headers
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["registry_id"] == registered_id
        assert body["verified"] is True
        assert body["bit_error_rate"] == 0.0
        assert body["failure_reason"] is None

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

    async def test_verify_response_includes_tier_and_watermark_id(
        self, client: AsyncClient, auth_headers: dict, registered_id: str
    ) -> None:
        resp = await client.post(
            f"/api/v1/certificates/{registered_id}/verify", headers=auth_headers
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["tier"] is not None
        assert body["watermark_id"] is not None
        assert body["bits_recovered"] is not None
