"""AWS Secrets Manager vault client (production).

Requires ``boto3`` and appropriate IAM permissions.
"""

from __future__ import annotations

import hashlib

from sentinel_api.config import settings
from sentinel_api.vault.base import AbstractVaultClient


class AWSSecretsVaultClient(AbstractVaultClient):
    """Retrieve keys from AWS Secrets Manager.

    The secret value must be a JSON object with key ``"value"`` containing
    the 64-char hex-encoded 32-byte key material::

        {"value": "aabbcc..."}

    Set ``SPREADING_KEY_ID`` to the full Secrets Manager ARN or secret name.
    """

    async def get_spreading_key(self, key_id: str) -> bytes:
        import json

        import boto3

        client = boto3.client("secretsmanager", region_name=settings.aws_region)
        response = client.get_secret_value(SecretId=key_id)
        secret = json.loads(response["SecretString"])
        return bytes.fromhex(secret["value"])

    async def get_signing_key(self, key_id: str) -> bytes:
        # Derive a distinct signing key from the spreading key so the two values
        # always differ — TINSELEncoder enforces this invariant at construction.
        spreading = await self.get_spreading_key(key_id)
        return hashlib.sha3_256(spreading + b":tinsel-signing-key-v1").digest()
