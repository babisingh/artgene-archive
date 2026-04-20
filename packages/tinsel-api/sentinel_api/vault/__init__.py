"""Vault abstraction — spreading key and signing key retrieval."""

from sentinel_api.config import settings
from sentinel_api.vault.base import AbstractVaultClient
from sentinel_api.vault.env_mock import EnvMockVaultClient


def get_vault_client() -> AbstractVaultClient:
    """Return the appropriate vault client for the current environment.

    Selection logic:
      test / development  → EnvMockVaultClient (reads SPREADING_KEY env var)
      production + no AWS → EnvMockVaultClient (Railway / Heroku / plain Docker)
      production + AWS    → AWSSecretsVaultClient (AWS_ACCOUNT_ID must be set)
    """
    if settings.sentinel_env in ("test", "development"):
        return EnvMockVaultClient()
    # In production, fall back to env-var injection when AWS is not configured.
    # Set AWS_ACCOUNT_ID to opt into AWS Secrets Manager.
    if not settings.aws_account_id:
        return EnvMockVaultClient()
    from sentinel_api.vault.aws_secrets import AWSSecretsVaultClient
    return AWSSecretsVaultClient()


__all__ = ["AbstractVaultClient", "EnvMockVaultClient", "get_vault_client"]
