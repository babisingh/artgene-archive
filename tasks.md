# ArtGene-Archive — Peer Review Fix Tracker

Fixes are divided into **CODE** (repo changes) and **PAPER** (docx edits).
Delete each task as it is completed.

---

## FATAL — Must resolve before any submission

### [MANUAL] Issue 1 — Obtain a live, verifiable AG-ID
- All gate values, FASTA, and paper text are real and ready
- **Action**: Submit `packages/tinsel-demo/sequences/01_glp1_pass.fasta` via artgene-archive.org/showcase
- **After deposit**: Replace every occurrence of `AG-2026-000001` with the real AG-ID in:
  - `paper/ArtGene_Archive_bioRxiv_REVISED.docx` — Section 4.3 intro, Figure 2 JSON (`"ag_id"`)
  - `apps/dashboard/app/showcase/page.tsx` — `CERT_FIELDS`, `COMPLIANCE_DOCS`, `REG_FALLBACK`
- AG-ID must be live-verifiable at artgene-archive.org/registry on submission day

### [MANUAL] Issue 3 — References: Renumber [22]–[25] out of first-appearance order
- De Haro (currently [25]) → [22]
- LinearFold (currently [22]) → [23]
- WOTS+ Huelsing (currently [23]) → [24]
- Regev LWE (currently [24]) → [25]
- [26], [27], [28], [29], [30] stay
- Update all in-text citations to match (search for `[22]`, `[23]`, `[24]`, `[25]` in the docx)
> Manual — requires careful cross-reference tracking across the full document.

---

## MODERATE — Expected at revision

### [MANUAL] Issue 18 — Embed Figure 1 pipeline diagram
- Export pipeline diagram at ≥ 300 DPI as PNG
- In the docx, insert the image at the Figure 1 caption location (currently just a text placeholder)
- Reformat the caption as a proper figure caption paragraph style

---

## MINOR — Should be corrected

### [MANUAL] Issue 9 (complete) — Fill in EO citation details
- Reference [29] is a placeholder: `[29] Executive Office of the President (2025). Executive Order ... Federal Register, 90(XX), [page range].`
- Fill in the exact EO title, number, and Federal Register page range for the 2025 nucleic acid synthesis screening EO

---

## COMPLETED ✓

### Session 3 (this session)
- [CODE+PAPER] Issue 1 (showcase-ready): Golden file `01_glp1_pass.json` updated with real 7M5T values; showcase `page.tsx` updated — DEMO_SEQS[0] is now HallProteIn-0515 (7M5T) with real gate fallback values; REG_FALLBACK, CERT_FIELDS, COMPLIANCE_DOCS all updated to AG-2026-000001; "blockchain-style" fixed to "hash-chained append-only" in features list
- [PAPER] Issue 15: Ref [10] Goad 1979 → Benson et al. 1993 (GenBank, NAR 21:13)
- [PAPER] Issue 17: Carlson 2016 [28] added as citation alongside [25, 26] in Section 5.1 (synthesis cost sentence)
- [PAPER] Issue 19: Next.js version confirmed — package.json shows ^16.2.2; paper text "Next.js 16 dashboard" is accurate
- [PAPER] Issue 20: Screening evasion citation [25] → [7, 25, 27] in Section 2.3
- [PAPER] Issues 4, 6, 7, 9: New content paragraphs added (pLDDT limitation, SynBioHub comparison, watermark validation plan, EO citation)

### Session 2
- [CODE+PAPER] Issue 1 (partial): Replaced fabricated demo sequence with PDB 7M5T; real gate values computed (pLDDT 77.6, GRAVY -0.667, HGT 3.28/100, CAI 1.000, SHA3-512 d06f9819…1e271); FASTA updated; reference [30] Anishchenko added; helper script `scripts/compute_real_gate_outputs.py` written

### Session 1
- [CODE] Issue 8: `event_nonce` added to WOTS+ `generate_keypair`
- [CODE] Issue 2 (code): `run_demo.py` — 4 gates, MockGate4Adapter wired throughout
- [CODE] Issue 5 (Gate 2): `composition.py` docstring — real thresholds, composition_heuristic_v1
- [CODE] Issue 5 (Gate 3): `codon.py` docstring — CAI (Sharp & Li 1987), HGT formula, FAIL threshold
- [CODE] Issue 10: `spreading.py` docstring — spreading factor, 1 chip/carrier codon
- [CODE] Issue 12: "blockchain-style" → "hash-chained append-only" in `db/models.py`, `routes/register.py`, `design-reference/CD_demo.md`
- [PAPER] Issue 2: Abstract Results — "Three primary biosafety gates operational; Gate delta pre-production"
- [PAPER] Issue 2b: "four-gate biosafety screening" in Section 4.1
- [PAPER] Issue 5 (beta/gamma): Gate descriptions updated with real thresholds and algorithms
- [PAPER] Issue 8: WOTS+ (master_seed, registry_id, event_nonce) described
- [PAPER] Issue 10: TINSEL — "distributed codon steganography", spreading factor explained
- [PAPER] Issue 11: Figure 2 hash field labelled as full 128-char SHA3-512
- [PAPER] Issue 12: "hash-chained append-only audit log" in Introduction
- [PAPER] Issues 13a/b/c: Rhetorical overclaims removed/softened
- [PAPER] Issue 14: Codon-swap attack and WOTS+ forgery resistance in Section 5.3
- [PAPER] Issue 16: CAI value note in Section 4.3 Gate gamma
- [PAPER] Issue 21: LLM usage statement updated
- [PAPER] Issue 22: Vague acknowledgment removed
