"""Vault abstraction — spreading key and signing key retrieval."""

from sentinel_api.vault.base import AbstractVaultClient
from sentinel_api.vault.env_mock import EnvMockVaultClient
from sentinel_api.config import settings


def get_vault_client() -> AbstractVaultClient:
    """Return the appropriate vault client for the current environment."""
    if settings.sentinel_env in ("test", "development"):
        return EnvMockVaultClient()
    # Phase 5+: return AWSSecretsVaultClient()
    from sentinel_api.vault.aws_secrets import AWSSecretsVaultClient
    return AWSSecretsVaultClient()


__all__ = ["AbstractVaultClient", "EnvMockVaultClient", "get_vault_client"]
