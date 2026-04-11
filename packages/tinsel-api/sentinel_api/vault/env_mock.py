"""Environment-variable mock vault — for local development and testing.

Reads the spreading key from the SPREADING_KEY environment variable
(expected as a 64-char hex string = 32 bytes).

NEVER use in production: the key material is visible in the process
environment and any crash dump.  Use AWSSecretsVaultClient in production.
"""

from __future__ import annotations

import hashlib

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
        """Derive a distinct signing key from the spreading key via SHA3-256.

        The two keys MUST differ (TINSELEncoder enforces this).  Phase 7 will
        replace this with a proper HKDF derivation from a separate secret.
        """
        spreading = await self.get_spreading_key(key_id)
        return hashlib.sha3_256(spreading + b":tinsel-signing-key-v1").digest()
