# tinsel-core

**TINSEL** (Traceable Identification of Novel Synthetic bio-Engineering by
codon-Level watermarking) is a Python library for embedding and verifying
cryptographic watermarks in protein-coding DNA sequences via synonymous codon
selection.

- Watermark is invisible at the protein level (synonymous codons encode the same amino acid)
- Statistically covert: chi-squared p-value > 0.05 under the uniform null hypothesis
- Error-correcting: Reed-Solomon codes protect the signature against point mutations
- Deterministic: same inputs → identical DNA, no secret state needed for verification
- Python 3.12+, no external dependencies beyond NumPy and Pydantic

---

## Quick Start

```python
import os
from tinsel import TINSELEncoder, TINSELDecoder, check_capacity

# Generate keys (store these securely — see SECURITY.md)
spreading_key = os.urandom(32)
signing_key   = os.urandom(32)

# Check how much watermark capacity a protein has
protein = "MAEQKLISEEDLNFPSTEKIQLLKEELDLFLQTSSKELEEVIQ" * 5
cap = check_capacity(protein)
print(f"Tier: {cap.tier}  Carriers: {cap.n_carrier_positions}")

# Encode
enc = TINSELEncoder(spreading_key, signing_key=signing_key)
result = enc.encode_v1(
    protein,
    owner_id="OWNER_A",
    timestamp_str="2027-01-01T00:00:00Z",
    ethics_code="ERC-001",
)

print(f"DNA: {result.dna_sequence[:60]}…")
print(f"Signature: {result.signature_hex}")
print(f"Covert: {result.codon_bias_metrics.is_covert}")

# Verify
dec = TINSELDecoder(spreading_key)
vr = dec.verify(
    result.dna_sequence,
    result.signature_hex,
    result.config,
    result.anchor_map,
    protein=protein,
)
print(f"Verified: {vr.verified}  BER: {vr.bit_error_rate:.4f}")
```

---

## Watermark Tiers

Tier is determined by the number of synonymous carrier bits in the protein.
Amino acids with a single codon (M, W) contribute zero carrier bits.

| Tier     | Min carriers | Signature | RS codec | Correctable |
|----------|-------------|-----------|----------|-------------|
| FULL     | 1,792       | 128-bit   | (32,16)  | 8 bytes     |
| STANDARD |   896       |  64-bit   | (16, 8)  | 4 bytes     |
| REDUCED  |   320       |  32-bit   | ( 8, 4)  | 2 bytes     |
| MINIMAL  |    96       |  16-bit   | ( 4, 2)  | 1 byte      |
| DEMO     |    24       |   8-bit   | none     | 0           |
| REJECTED |   < 24      | —         | —        | —           |

FULL tier is achieved by proteins of approximately 1,200+ amino acids (depending
on composition).  A typical 500 AA protein lands in REDUCED/STANDARD tier.

---

## Supported Host Organisms

The `HostOrganism` enum lists the registered expression hosts:

| Value    | Description                                  |
|----------|----------------------------------------------|
| `ECOLI`  | *Escherichia coli* (default codon table)     |
| `HUMAN`  | *Homo sapiens*                               |
| `YEAST`  | *Saccharomyces cerevisiae*                   |
| `CHO`    | Chinese hamster ovary cell lines             |
| `INSECT` | *Sf9* / baculovirus expression               |
| `PLANT`  | *Arabidopsis* / plant expression             |

Organism-specific codon optimisation is not yet implemented in v1.0.
All tiers use the standard NCBI genetic code (CODON_POOLS).

---

## Algorithm

### Encoding

```
protein → AnchorMap (synonymous positions)
              ↓
        HMAC-SHA3-256(signing_key, owner‖timestamp‖ethics) → signature[:sig_bytes]
              ↓
        Reed-Solomon encode → codeword (if tier ≠ DEMO)
              ↓
        SpreadingCodeGenerator(spreading_key).spread(codeword_bits, label)
              ↓
        embed spread_bits into codons at anchor positions
              ↓
        DNA sequence + CodonBiasMetrics
```

### Verification

```
DNA + protein + AnchorMap → raw codon-choice bits at carrier positions
              ↓
        SpreadingCodeGenerator(spreading_key).spread(raw_bits, label)  [de-spread]
              ↓
        RSCodec.decode(despread_bytes) → candidate_signature
              ↓
        candidate_signature == expected_signature?  →  VerificationResult
```

### Spreading code

```python
block_i = HMAC-SHA3-256(spreading_key, label ‖ i.to_bytes(4, 'big'))
chip_j  = block_j[j % 32] & 1   # one chip per byte, LSB
```

---

## Reed-Solomon Codec

`RSCodec` implements a pure-Python systematic RS code over GF(2^8) using
primitive polynomial 0x11d, Berlekamp-Massey decoding, and the Forney algorithm.

```python
from tinsel import RSCodec, ReedSolomonError

codec = RSCodec(nsym=8)          # 8 parity symbols → corrects 4 byte errors
cw = codec.encode(b"TINSEL")    # systematic: codeword[:6] == b"TINSEL"
msg, n_errs = codec.decode(cw)  # returns (b"TINSEL", 0)
```

---

## Installation

```bash
pip install tinsel-core        # from PyPI (once released)
# or
uv add tinsel-core
```

### Development

```bash
git clone https://github.com/babisingh/artgene-archive
cd artgene-archive
uv sync
uv run --python 3.12 pytest packages/tinsel-core/tests/ -v
```

---

## License

MIT.  See `LICENSE` for details.

## Security

See [`SECURITY.md`](SECURITY.md) for the vulnerability reporting policy and
security design notes.
