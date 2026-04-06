"""Abstract vault client — interface for secret retrieval."""

from abc import ABC, abstractmethod


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
