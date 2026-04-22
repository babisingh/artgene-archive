"""Abstract vault client — interface for secret retrieval."""

from __future__ import annotations

import hashlib
import hmac
from abc import ABC, abstractmethod


def _derive_signing_key(spreading_key: bytes) -> bytes:
    """Derive a distinct signing key from the spreading key via HMAC-SHA3-256.

    Uses the spreading key as the HMAC key and a fixed domain label as the
    message, providing proper key separation.  Both vaults must use this
    function so dev and production key derivation are identical.
    """
    return hmac.digest(spreading_key, b"tinsel-signing-key-v1", hashlib.sha3_256)


class AbstractVaultClient(ABC):
    """Interface for retrieving cryptographic keys from a secrets store."""

    @abstractmethod
    async def get_spreading_key(self, key_id: str) -> bytes:
        """Return the 32-byte spreading key for *key_id*.

        Raises
        ------
        KeyError
            If *key_id* is not found in the vault.
        """

    @abstractmethod
    async def get_signing_key(self, key_id: str) -> bytes:
        """Return the 32-byte signing key for *key_id* (W-OTS+ seed)."""
