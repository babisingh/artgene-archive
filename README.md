# ArtGene-Archive

**A cryptographic provenance and biosafety certification registry for
AI-generated biological sequences.**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Registry](https://img.shields.io/badge/Registry-Live-brightgreen)](https://artgene-archive.org/registry)
[![Demo](https://img.shields.io/badge/Demo-artgene--archive.org%2Fshowcase-blue)](https://artgene-archive.org/showcase)
[![Paper](https://img.shields.io/badge/Paper-bioRxiv-orange)](https://artgene-archive.org)
[![Governed by](https://img.shields.io/badge/Governed_by-ArtGene_Consortium_v1.0-lightgrey)](https://artgene-archive.org/about)

---

## What this is

Generative AI models now produce novel proteins, genes, and regulatory elements
faster than the scientific community can catalogue, screen, or attribute them.
No shared infrastructure currently exists to distinguish AI-designed sequences
from naturally occurring ones, evaluate them for biosafety at the point of
design, or issue cryptographically verifiable creator attribution.

ArtGene-Archive is that infrastructure.

> What GenBank was to the automated sequencer in 1982, ArtGene-Archive is to
> the generative model in 2026.

Every sequence deposited in ArtGene-Archive:

1. Passes a **four-gate automated biosafety screen** (structural confidence,
   off-target composition, ecological risk, and watermark integrity).
2. Receives a **TINSEL spread-spectrum codon watermark** that embeds a
   128-bit institutional signature through synonymous codon substitution,
   leaving the encoded protein sequence and function biologically unchanged.
   The watermark survives re-synthesis and is recoverable from re-sequenced DNA
   in any laboratory.
3. Is issued a **WOTS+ post-quantum signed HybridCertificate** appended to a
   tamper-evident SHA3-256-chained audit log.

Registration is free. Records are public by default. The registry is governed
by the ArtGene Consortium as public-interest scientific infrastructure.

---

## Live system

| Resource | URL |
|---|---|
| Registry and certificate browser | [artgene-archive.org/registry](https://artgene-archive.org/registry) |
| Interactive pipeline demo | [artgene-archive.org/showcase](https://artgene-archive.org/showcase) |
| Deposit a sequence | [artgene-archive.org/register](https://artgene-archive.org/register) |
| API documentation | [artgene-archive.org/getting-started](https://artgene-archive.org/getting-started) |
| Charter and governance | [artgene-archive.org/about](https://artgene-archive.org/about) |

---

## Cite this work

If you use ArtGene-Archive in your research, please cite:

```
Singh, B. (2026). ArtGene-Archive: A Cryptographic Certification Registry
for AI-Generated Biological Sequences. bioRxiv.
doi: XX_BIORXIV_DOI
```

An AG-ID (e.g. `AG-2026-018427`) in your manuscript or supplementary materials
serves as a persistent, verifiable deposit record. Journals publishing
AI-generated sequence work are encouraged to require AG-IDs as submission
conditions, analogous to the GenBank accession number requirement for
sequencing papers.

---

## Architecture

```
artgene-archive/
|
+-- tinsel-core/          Python. Data models, TINSEL encoder/decoder,
|                         Reed-Solomon GF(2^8) codec, HMAC-SHA3-256
|                         spread-spectrum engine.
|
+-- tinsel-gates/         Python. Four-gate biosafety pipeline.
|   |                     Live ESMFold adapter (Gate alpha).
|   |                     Composition heuristics (Gates beta, gamma).
|   +-- adapters/         SecureDNA DOPRF + IBBIS production adapters
|                         (credentials required; mock stubs active in dev).
|
+-- tinsel-api/           Python/FastAPI. REST API, PostgreSQL persistence,
|                         Alembic migrations, WOTS+ certificate signing,
|                         tamper-evident audit log, rate limiting,
|                         API key authentication.
|
+-- dashboard/            TypeScript/Next.js 16. Submit, browse, verify,
|                         certificate detail, compliance manifest download.
|
+-- docs/                 Technical specification, API reference,
                          TINSEL algorithm description, charter documents.
```

### The four biosafety gates

| Gate | Name | Method | Fail behaviour |
|---|---|---|---|
| Alpha | Structural confidence | ESMFold pLDDT scoring; LinearFold ΔMFE | Fail-fast; pipeline halts |
| Beta | Off-target and composition | GRAVY score; toxin probability; allergen probability; AMP k-mer overlap; SecureDNA DOPRF; IBBIS screen | Concurrent with gamma |
| Gamma | Ecological risk | HGT propensity; GC content; codon adaptation index | Concurrent with beta |
| Delta | Watermark integrity | TINSEL embed verification prior to certificate issuance | Under active development |

Failure at any gate returns a structured consequence report identifying the
gate, the failing metric, the observed value, and the decision threshold.
Opaque rejection is by design not supported.

### The TINSEL watermark

TINSEL (Traceable INtegrated Sequence ELement) embeds provenance through
synonymous codon substitution. Because most amino acids are encoded by
multiple synonymous codons, arbitrary information can be encoded without
altering the protein the sequence produces.

Watermark tier is assigned automatically from the number of synonymous carrier
codons available in the submitted sequence:

| Tier | Min carrier codons | Watermark bits | RS codec | Error tolerance |
|---|---|---|---|---|
| FULL | 1,792 | 128-bit | (32, 16) | 8 bytes |
| STANDARD | 896 | 64-bit | (16, 8) | 4 bytes |
| REDUCED | 320 | 32-bit | (8, 4) | 2 bytes |
| MINIMAL | 96 | 16-bit | (4, 2) | 1 byte |
| DEMO | 24 | 8-bit | None | 0 bytes |
| REJECTED | less than 24 | -- | -- | Too short |

**Note on key security:** The TINSEL spreading key and the Verify Source
decoder logic are server-side only and are not distributed in this repository.
The algorithm is open; the cryptographic keys are not. `SENTINEL_ENV=production`
requires a custom `SPREADING_KEY` to be set or the API refuses startup.

### The HybridCertificate and audit log

Each deposited sequence is issued a signed JSON certificate containing the
registry ID, SHA3-512 sequence hash, biosafety gate outcomes, watermark
parameters, submitter identity, and timestamp. Certificates are chained to an
immutable audit log via:

```
entry_hash = SHA3-256(seq_num || prev_entry_hash || certificate_hash)
```

A PostgreSQL trigger blocks any UPDATE or DELETE at the database level. An
ORM-level `AppendOnlyMixin` raises a `RuntimeError` on any post-commit field
mutation. Two independent immutability layers mean no database administrator
can silently alter a historical record.

Certificates are signed with WOTS+ (Winternitz One-Time Signature Scheme).
The private key is discarded after use and never stored. LWE lattice
commitments are planned for Phase 4 as a post-quantum upgrade for certificates
cited in regulatory submissions years after registration.

---

## Quickstart

The full stack runs locally with no external services required.

### Prerequisites

- Docker and Docker Compose
- Python 3.11 or later (for running tests outside Docker)

### Run locally

```bash
git clone https://github.com/babisingh/artgene-archive.git
cd artgene-archive
cp .env.example .env          # defaults work for local development
docker compose up --build
```

The API is available at `http://localhost:8000`. The dashboard is available at
`http://localhost:3000`. API documentation is at `http://localhost:8000/docs`.

In development mode, `SENTINEL_ENV=development`, all biosafety gates run with
mock stubs. Set `SENTINEL_ENV=production` and supply the required API
credentials in `.env` to activate live ESMFold, SecureDNA DOPRF, and IBBIS
adapters.

### Run tests

```bash
cd tinsel-core && pip install -e ".[dev]" && pytest -v    # 51 unit tests
cd tinsel-gates && pytest -v
cd tinsel-api && pytest -v
```

### Submit a sequence via API

```bash
curl -X POST https://artgene-archive.org/api/v1/sequences \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "fasta": ">my_sequence\nMKTAYIAKQRQISFVKSHFSRQ...",
    "model_provenance": "RFdiffusion v1.1.0",
    "host_organism": "Homo sapiens",
    "visibility": "public"
  }'
```

A successful submission returns a HybridCertificate JSON object containing
your AG-ID, biosafety gate outcomes, and TINSEL watermark parameters.

### Verify a certificate

```bash
curl https://artgene-archive.org/api/v1/verify/AG-2026-018427
```

Or use the web interface at
[artgene-archive.org/registry](https://artgene-archive.org/registry).

---

## Implementation status (April 2026)

| Feature | Status |
|---|---|
| FASTA parsing (protein; RNA detection) | Live |
| SHA3-256 sequence deduplication | Live |
| Three-gate biosafety pipeline (mock in dev; live adapters in production) | Live |
| TINSEL codon watermark encoder and decoder with Reed-Solomon codec | Live |
| WOTS+ post-quantum certificate signing | Live |
| Tamper-evident SHA3-256 chained audit log | Live |
| Fragment 20-mer k-mer cross-check (privacy-preserving hashed index) | Live |
| Per-recipient codon fingerprint and leak attribution (Verify Source) | Live |
| Embargoed and public visibility control | Live |
| REST API with rate limiting and API key authentication | Live |
| Next.js dashboard (submit, browse, verify, certificate detail) | Live |
| Compliance manifest (US DURC, EU Dual-Use framework) | Live |
| Synthesiser authorisation document generation | Live |
| ESMFold live integration (non-mock, production mode) | In progress |
| FASTA parsing for DNA sequence optimisation | In progress |
| LWE lattice commitments (post-quantum Phase 4) | Planned |
| CDK / Terraform infrastructure-as-code (Phase 5) | Planned |
| Merkle inclusion proofs for pathway bundles (Phase 6) | Planned |
| Institutional API key management portal | Planned |
| ORCID and academic identity integration | Planned |
| Journal submission workflow integration | Future |
| Benchside synthesiser protocol interface | Future |

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md)
before opening a pull request.

Gate-level changes require biosafety review panel approval. All other changes
follow standard pull request review.

---

## Governance

ArtGene-Archive is operated by the **ArtGene Consortium** as public-interest
scientific infrastructure. The registry is free to use and open by default.
The Consortium charter, data-access policy, and biosafety review panel
composition are documented at
[artgene-archive.org/about](https://artgene-archive.org/about).

Institutions wishing to join the Consortium as charter signatories, data
mirrors, or biosafety review panel members should contact
b@genethropic.com.

---

## Biosafety and responsible use

ArtGene-Archive was built to reduce biosecurity risk from AI-generated
biological sequences, not to eliminate all friction from synthetic biology
workflows. The registry is not a substitute for institutional biosafety
committee review, synthesis company screening, or emerging regulatory
requirements.

No biosafety screening system can guarantee sequence safety. Biosafety is
probabilistic, context-dependent, and subject to emergent properties that
computational tools cannot fully anticipate. If you identify a sequence in
the registry that you believe poses an uncharacterised risk, contact
b@genethropic.com immediately. Flagged records are routed to the human
biosafety review panel within 24 hours.

---

## License

Apache License 2.0. See [LICENSE](LICENSE).

Copyright 2026 Babita Singh / ArtGene Consortium.

The TINSEL algorithm, gate pipeline, and registry architecture are open for
reuse under Apache 2.0. Institutional spreading keys and production Verify
Source decoder logic are not distributed and remain proprietary to the
operating infrastructure.

---

## Acknowledgements

This project was initiated at the AIxBio Hackathon, April 2026, organised by
Apart Research. The registry infrastructure draws on operational experience at
the European Genome-phenome Archive (EGA/EMBL-EBI/CRG).

Gene-story, Gene-Intel, and Gene-Maps are companion projects by Genethropic.
See [genethropic.com](https://genethropic.com).

---

*ArtGene Consortium · artgene-archive.org · est. 2026 · Apache 2.0*
