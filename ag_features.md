# ArtGene Archive — Feature List

A concise reference for the paper. One or two sentences per feature.

---

## Registration & Certification

**Sequence Registration**
Researchers submit a protein-coding sequence in FASTA format along with metadata (owner ID, organisation UUID, IRB ethics code, host organism). A unique Registry ID (e.g. `AG-2026-000001`) and a SHA3-512 certificate hash are issued on success.

**Visibility Control (Public / Embargoed)**
A sequence can be registered as *embargoed* — invisible to other organisations until explicitly published. This lets teams secure priority before disclosure.

---

## Biosafety Screening

**Gate 1 — Structural Analysis**
Uses ESMFold-derived pLDDT scores to assess predicted folding confidence and RNA minimum free energy (ΔMFE). Sequences with more than 20 % of residues at pLDDT < 50 (disordered fraction) fail this gate. A Gate 1 failure triggers fail-fast, skipping Gates 2 and 3.

**Gate 2 — Composition Heuristic Screen**
Amino-acid composition analysis covering Kyte–Doolittle hydropathy (GRAVY), cationic/amphipathic toxin probability, allergen probability estimation, and a curated k-mer screen for known antimicrobial peptide scaffolds. Full BLAST screening against pathogen/toxin databases is planned for Phase 3.

**Gate 3 — Ecological Risk**
Horizontal Gene Transfer (HGT) propensity scoring and DriftRadar ecological-spread modelling estimate environmental containment risk based on codon usage, GC content, and host-organism compatibility.

**Actionable Failure Guidance**
When a gate fails, the certificate card shows a plain-language explanation of what failed and how to fix it (e.g. redesign low-complexity regions for Gate 1, reduce K+R density for Gate 2, codon-optimise for Gate 3).

---

## Provenance Tracing

**Per-Recipient Codon Fingerprinting**
When a certified sequence is distributed, a unique HMAC-SHA3-256-derived seed generates a recipient-specific codon pattern via the TINSEL encoder. The amino acid sequence and protein function are identical across all copies; only synonymous codon choices differ.

**Distribution Copy Issuance**
From the sequence detail page, a researcher can issue a FASTA distribution copy for any recipient (name, organisation, email, purpose, host organism). An issuance record linking the fingerprint seed to the recipient is stored in the database. The copy is returned as a downloadable FASTA file.

**Leak Attribution (Verify Source)**
If a distribution copy appears somewhere unexpected, it can be pasted into the *Verify Source* page. The platform replays the fingerprint encoding for every issued copy and identifies which recipient's copy matches, without requiring any metadata in the submitted file.

---

## Public Registry

**Searchable Certificate Registry**
A paginated table lists all certified and rejected sequences with Registry ID, status, tier, owner, host organism, and registration date. Accessible without authentication for public sequences.

**Sequence Detail Page**
Each sequence has a dedicated detail page with the full certificate (gate outcomes, hash, metadata), a Provenance Tracing tab listing all issued copies, and a raw SCD (ArtGene-SCD-1.0) JSON viewer.

---

## Fragment Assembly Screen

**Fragment-Level Biosafety Check**
A separate `/analyse/fragments` endpoint accepts multiple FASTA fragments and checks whether their assembly would reconstitute a known problematic sequence. This is independent of the registration flow and can be used for pre-synthesis screening.

---

## Demo

**Interactive Provenance Tracing Demo**
A public demo page (no authentication required) accepts any protein FASTA, generates two fingerprinted distribution copies (Recipient A and Recipient B), and shows the synonymous substitution table and a simulated verify-source result to illustrate the full leak-attribution flow.

---

## Infrastructure

**Post-Quantum Signing (stub)**
WOTS+/LWE-based post-quantum signatures are provisioned via a Vault-backed master seed (Phase 7). The certificate currently records the signing key reference; live signing is not yet active.

**API Key Authentication**
Every mutating endpoint requires an `X-API-Key` header. Keys are scoped to organisations; the organisation UUID is derived server-side from the key, so it cannot be spoofed.

**Health Endpoint**
`GET /health` reports database and Vault connectivity status, used by the dashboard status bar.
