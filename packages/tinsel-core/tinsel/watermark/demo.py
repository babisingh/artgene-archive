#!/usr/bin/env python
"""
TINSEL Watermark Demo — Phase 0 scaffold verification.

Encodes two canonical demo sequences with a development spreading key,
then verifies the round-trip.  Both must show VERIFIED ✓.

Usage
-----
    # Default (uses built-in dev key):
    PYTHONPATH=packages/tinsel-core python packages/tinsel-core/tinsel/watermark/demo.py

    # With a real spreading key from .env:
    SPREADING_KEY=$(python -c "import secrets; print(secrets.token_hex(32))") \\
        PYTHONPATH=packages/tinsel-core \\
        python packages/tinsel-core/tinsel/watermark/demo.py
"""

from __future__ import annotations

import os
import sys
import textwrap

from tinsel.watermark.encoder import (
    decode_protein,
    encode,
    verify,
    watermark_capacity,
)

# ---------------------------------------------------------------------------
# Demo sequences
# ---------------------------------------------------------------------------
DEMO_SEQUENCES: list[tuple[str, str, str]] = [
    (
        "NB-GLP1-047",
        "AG-2027-000001",
        "HAEGTFTSDVSSYLEGQAAKEFIAWLVKGRCEGVLGDTFR",
    ),
    (
        "CRISPR-CAS9-FRAG-001",
        "AG-2027-000002",
        "MDKKYSIGLDIGTNSVGWAVITDEYKVPSKKFKVLGNTDRHSIKKNLIGALLFDSGETAE",
    ),
]

# ---------------------------------------------------------------------------
# Spreading key — 32 bytes.
# In production this comes from AWS Secrets Manager via the vault client.
# For this demo we fall back to a deterministic dev key if the env var
# is absent (NEVER use in production).
# ---------------------------------------------------------------------------
_DEV_KEY_HEX = "a" * 64  # 32 bytes of 0xaa — development only


def _load_key() -> bytes:
    raw = os.environ.get("SPREADING_KEY", _DEV_KEY_HEX)
    try:
        key = bytes.fromhex(raw)
    except ValueError:
        print(f"[ERROR] SPREADING_KEY is not valid hex: {raw!r}", file=sys.stderr)
        sys.exit(1)
    if len(key) != 32:
        print(
            f"[ERROR] SPREADING_KEY must be exactly 32 bytes ({len(key)} provided)",
            file=sys.stderr,
        )
        sys.exit(1)
    return key


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    key = _load_key()
    source = "env var" if "SPREADING_KEY" in os.environ else "built-in dev key"

    print()
    print("  TINSEL Watermark Demo")
    print("  " + "─" * 54)
    print(f"  Spreading key source : {source}")
    print(f"  Key fingerprint      : {key[:4].hex()}…{key[-4:].hex()}")
    print()

    all_ok = True

    for seq_id, watermark_id, protein in DEMO_SEQUENCES:
        capacity = watermark_capacity(protein)

        # Encode
        dna = encode(protein, key, watermark_id)

        # Decode protein back from DNA (translation check)
        recovered = decode_protein(dna)
        translation_ok = recovered == protein

        # Verify via key round-trip
        ok = verify(dna, key, watermark_id, protein) and translation_ok

        if not ok:
            all_ok = False

        status = "VERIFIED ✓" if ok else "FAILED   ✗"
        print(f"  Sequence    : {seq_id}")
        print(f"  Registry ID : {watermark_id}")
        print(f"  Protein     : {protein[:40]}{'…' if len(protein) > 40 else ''}")
        print(f"  DNA (first) : {dna[:45]}…")
        print(f"  Capacity    : {capacity} watermark bits across {len(protein)} residues")
        print(f"  Status      : {status}")
        print()

    print("  " + "─" * 54)
    if all_ok:
        print("  All sequences VERIFIED ✓  —  Phase 0 scaffold OK")
    else:
        print("  One or more sequences FAILED ✗  —  check spreading key")
        sys.exit(1)
    print()


if __name__ == "__main__":
    main()
