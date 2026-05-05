# ArtGene-Archive — Peer Review Fix Tracker

Fixes are divided into **CODE** (repo changes) and **PAPER** (docx edits).
Delete each task as it is completed.

---

## FATAL — Must resolve before any submission

### [PAPER] Issue 1 — Section 4.3: Replace fabricated demo data with real pipeline output
- Run the actual pipeline on `packages/tinsel-demo/sequences/01_glp1_pass.fasta` using real adapters (ESMFold + composition + codon gates)
- Record all real gate outputs, timing, and a complete untruncated SHA3-512 hash
- Deposit sequence into the live registry and obtain a real AG-ID
- Replace every number in Section 4.3 with real outputs (pLDDT mean, GRAVY, toxin prob, HGT score, timing)
- Add the FASTA to a supplementary file
- AG-ID must be live-verifiable at artgene-archive.org/registry on submission day
- The hash placeholder in Figure 2 JSON must be replaced with the full 128-character SHA3-512 hex
- The CAI value note `[Note: ...]` in Gate gamma must be replaced with the actual number
> **Requires**: live deployment access + real ESMFold API call. Cannot be done in code.

### [PAPER] Issue 3 — References: Renumber [22]–[24] out of first-appearance order
- De Haro (currently [25]) → [22]
- LinearFold (currently [22]) → [23]
- WOTS+ Huelsing (currently [23]) → [24]
- Regev LWE (currently [24]) → [25]
- [26], [27], [28] stay
- Update all in-text citations to match
> Manual task — complex citation renumbering with cross-reference tracking.

---

## MAJOR — Required for acceptance

### [PAPER] Issue 4 — Gate alpha 20% pLDDT threshold: add empirical justification
- Either cite a DisProt/IDP benchmark supporting the threshold
- Or add to Section 5.3 Limitations: "The 20% threshold for low-confidence residue fraction has not been benchmarked against a held-out set of known functional IDPs from DisProt; false-positive rate for functional disordered proteins is an acknowledged limitation."

### [PAPER] Issue 6 — Add SynBioHub / iGEM Registry / Addgene comparison
- Add a paragraph in Section 2.1 or new Section 2.4
- SynBioHub: no mandatory biosafety gate; no AI-origin labelling requirement
- iGEM Registry: no cryptographic provenance layer; no AI-origin deposition requirement
- Addgene: hosts constructs but no sequence-level biosafety gate or watermark

### [PAPER] Issue 7 — TINSEL watermark robustness: add computational validation or move claim
- Option A: Add Section 3.4.1 or supplementary figure with ART/BadRead simulation across Illumina (~0.1% substitution) and Nanopore (~1-5% including indels) error profiles; report minimum depth for >95% watermark recovery per tier
- Option B: Move robustness claim from main text to "planned validation" in Section 5.2; remove from Abstract

### [PAPER] Issue 9 — White House EO: add direct primary citation
- Add direct citation for the executive order separate from arXiv [9]
- Citation: Executive Office of the President (2025). Executive Order [title and number]. Federal Register.
- Replace [9] on the EO claim with the new reference number

---

## MODERATE — Expected at revision

### [PAPER] Issue 15 — Replace Ref [10] Goad 1979 with retrievable citation
- Replace with: Benson, D.A. et al. (1993). GenBank. Nucleic Acids Research, 21(13), 2963–2965.
- Or consolidate with existing [13] if it covers the same ground

### [PAPER] Issue 17 — Ref [28] Carlson 2016 uncited in text
- Either (a) add in-text citation of Carlson 2016 in Section 5.1 at an appropriate point about the scale of synthetic biology outputs
- Or (b) remove reference [28] from the list and renumber if needed

### [PAPER] Issue 18 — Embed Figure 1 pipeline diagram
- Export pipeline diagram at ≥ 300 DPI as PNG
- Embed as an actual image in the document at the Figure 1 caption location
- Reformat the caption as a proper figure caption paragraph

---

## MINOR — Should be corrected

### [PAPER] Issue 19 — Verify Next.js version
- `apps/dashboard/package.json` shows `"next": "^16.2.2"` — confirm this matches production deployment
- If correct, paper text "Next.js 16 dashboard" is accurate; if production runs 15.x, correct the paper

### [PAPER] Issue 20 — Fix citation [25] on screening evasion claim (Section 2.3)
- Replace [25] with [7, 27] or add these alongside [25] for the AI evasion of sequence-based screening claim
- Verify De Haro (Applied Biosafety, 2024) actually supports this specific claim

---

## COMPLETED ✓

- [CODE] Issue 8: Added `event_nonce` to WOTS+ `generate_keypair` in `tinsel/crypto/wots.py`; updated module docstring explaining signing-event uniqueness
- [CODE] Issue 2 (code): Fixed `run_demo.py` — manifest comments "3 gates" → "4 gates", added explicit `MockGate4Adapter` to all 6 manifest entries, wired `gate4_adapter` through `run_consequence_pipeline` call
- [CODE] Issue 5 (Gate 2): Updated `adapters/gate2/composition.py` module docstring — clarifies screening_method is `composition_heuristic_v1` (not ToxinPred2/APD3), states actual thresholds (toxin ≥ 0.30 FAIL, allergen ≥ 0.40 FAIL, ≥ 0.30 WARN)
- [CODE] Issue 5 (Gate 3): Updated `adapters/gate3/codon.py` module docstring — names CAI algorithm (Sharp & Li 1987), documents HGT composite formula and 0–100 scale, states FAIL threshold 50/100
- [CODE] Issue 10: Added spreading factor section to `tinsel/watermark/spreading.py` docstring — 1 chip per carrier codon, total capacity = synonymous carrier positions
- [CODE] Issue 12: Replaced all "blockchain-style" occurrences in code files with "hash-chained append-only" (`db/models.py`, `routes/register.py`, `design-reference/CD_demo.md`)
- [PAPER] Issue 2: Abstract Results updated — "Three biosafety gates" → "Three primary biosafety gates are fully operational... Gate delta operational in pre-production demo mode"
- [PAPER] Issue 2b: "three-gate biosafety screening" → "four-gate biosafety screening" in Section 4.1
- [PAPER] Issue 5 (beta): Gate beta paragraph updated with actual tool (composition_heuristic_v1), correct thresholds (0.30/0.40), explicit note on Phase 3 integration
- [PAPER] Issue 5 (gamma): Gate gamma paragraph updated with CAI algorithm (Sharp & Li 1987), HGT composite formula, FAIL threshold 50/100
- [PAPER] Issue 8 (paper): WOTS+ section updated to describe (master_seed, registry_id, event_nonce) derivation and one-time guarantee
- [PAPER] Issue 10: TINSEL section updated — "distributed codon steganography" replaces "spread-spectrum codon steganography", spreading factor explained, telecom analogy acknowledged
- [PAPER] Issue 11: Figure 2 JSON hash field labeled as `[full 128-character SHA3-512 hex from live pipeline run]`
- [PAPER] Issue 12: "blockchain-style audit log" → "hash-chained append-only audit log" in Introduction
- [PAPER] Issue 13a: "Three structural problems compound simultaneously" → "have emerged simultaneously"
- [PAPER] Issue 13b: Deleted "The analogy between ArtGene-Archive and GenBank in 1979 is the central argument of this paper."
- [PAPER] Issue 13c: "most consequential non-technical task ahead" → specific governance requirement sentence
- [PAPER] Issue 14: Added codon-swap attack and WOTS+ certificate forgery resistance discussion to Section 5.3
- [PAPER] Issue 16: Added CAI value note to Section 4.3 Gate gamma (flagged for replacement with live value)
- [PAPER] Issue 21: Updated LLM usage statement to specify Claude Code for code, Claude for text drafting, author verification of all technical claims
- [PAPER] Issue 22: Removed vague "AI biosafety researchers" acknowledgment sentence; retained Apart Research acknowledgment
