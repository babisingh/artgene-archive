"""TINSEL spreading-code generator for watermark embedding and extraction.

The spreading code is a pseudo-random binary sequence derived from the
spreading key and a context label via counter-mode HMAC-SHA3-256.  Each
watermark bit is XOR'd with a chip from this sequence before being encoded
into a codon choice, providing:

- **Confusion**: without the key, codon choices appear uniformly random.
- **Diffusion**: a single-bit flip in the watermark payload affects all
  positions after de-spreading (BER ≈ 50 % with wrong key).
- **Determinism**: same inputs → identical spread sequence, enabling
  clean-channel verification without any stored state beyond the key.

Usage
-----
>>> gen = SpreadingCodeGenerator(key=bytes(32))
>>> chips = gen.generate(length=256, label=b"DEMO-01")
>>> chips.shape
(256,)
>>> chips.dtype
dtype('uint8')
>>> set(chips.tolist()).issubset({0, 1})
True
"""

from __future__ import annotations

import hashlib
import hmac

import numpy as np


class SpreadingCodeGenerator:
    """Generate a pseudo-random spreading code from a secret key.

    Parameters
    ----------
    key:
        32-byte HMAC key (spreading key material).  Must not be reused
        across different installations without key separation.

    Notes
    -----
    The spreading sequence is generated in 32-byte blocks (SHA3-256 output).
    Each block expands a counter concatenated with a context label:

        block_i = HMAC-SHA3-256(key, label ‖ i.to_bytes(4, 'big'))

    Bits are extracted from the LSB of each byte (bit 0), giving one
    chip per byte.  This keeps the relationship with the HMAC output
    simple and auditable.
    """

    def __init__(self, key: bytes) -> None:
        if len(key) != 32:
            raise ValueError("SpreadingCodeGenerator requires a 32-byte key")
        self._key = key

    def generate(self, length: int, label: bytes = b"") -> np.ndarray:
        """Generate a binary spreading code of *length* chips.

        Parameters
        ----------
        length:
            Number of bits (chips) to generate.
        label:
            Context label (e.g. the watermark_id encoded as UTF-8 bytes).
            Different labels produce independent, uncorrelated sequences.

        Returns
        -------
        numpy.ndarray
            Shape ``(length,)``, dtype ``uint8``, values in {0, 1}.
        """
        if length <= 0:
            return np.zeros(0, dtype=np.uint8)

        raw: list[int] = []
        counter = 0
        while len(raw) < length:
            msg = label + counter.to_bytes(4, "big")
            block = hmac.new(self._key, msg, hashlib.sha3_256).digest()
            # One chip per byte, from the least-significant bit
            raw.extend(b & 1 for b in block)
            counter += 1

        return np.array(raw[:length], dtype=np.uint8)

    def spread(self, bits: np.ndarray, label: bytes = b"") -> np.ndarray:
        """XOR *bits* with the spreading code (spread or de-spread).

        Because the operation is its own inverse (XOR), this same method
        is used both for spreading during encoding and de-spreading during
        decoding.

        Parameters
        ----------
        bits:
            Binary array to spread/de-spread, shape ``(n,)``, dtype uint8.
        label:
            Same label used when generating the spreading code.

        Returns
        -------
        numpy.ndarray
            Shape ``(n,)``, dtype uint8, spread/de-spread result.
        """
        code = self.generate(len(bits), label)
        return np.bitwise_xor(bits, code).astype(np.uint8)
