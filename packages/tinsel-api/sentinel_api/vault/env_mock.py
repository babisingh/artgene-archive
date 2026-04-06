"""Environment-variable mock vault — for local development and testing.

Reads the spreading key from the SPREADING_KEY environment variable
(expected as a 64-char hex string = 32 bytes).

NEVER use in production: the key material is visible in the process
environment and any crash dump.  Use AWSSecretsVaultClient in production.
"""

from __future__ import annotations

from sentinel_api.config import settings
from sentinel_api.vault.base import AbstractVaultClient


class EnvMockVaultClient(AbstractVaultClient):
    """Read ``SPREADING_KEY`` from the environment."""

    async def get_spreading_key(self, key_id: str) -> bytes:
        try:
            return bytes.fromhex(settings.spreading_key)
        except ValueError as exc:
            raise KeyError(
                f"SPREADING_KEY env var is not valid hex: {exc}"
            ) from exc

    async def get_signing_key(self, key_id: str) -> bytes:
        # For MVP the spreading key doubles as the signing key seed.
        # Phase 7 will derive a separate signing key via HKDF.
        return await self.get_spreading_key(key_id)
