# ArtGene-Archive — Peer Review Fix Tracker

Fixes are divided into **CODE** (repo changes) and **PAPER** (docx edits).
Delete each task as it is completed.

---

## FATAL — Must resolve before any submission

### [PAPER] Issue 1 — Live registry deposit still required
- All Section 4.3 numbers are now real and computed (see COMPLETED below)
- Remaining task: deposit sequence via artgene-archive.org/showcase to obtain a live, verifiable AG-ID
- The placeholder AG-2026-000001 must become a real registry entry verifiable at artgene-archive.org/registry on submission day
> **Requires**: live deployment access only (all gate values are already real)

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

- [PAPER] Issue 4: Added pLDDT threshold limitation paragraph to Section 5.3 — notes DisProt benchmark gap and false-positive risk for functional IDPs
- [PAPER] Issue 6: Added SynBioHub/iGEM Registry/Addgene comparison paragraph in Section 2.1 after EGA description
- [PAPER] Issue 7: Added TINSEL watermark validation plan paragraph to Section 5.2 — references ART/BadRead simulation plan and Reed-Solomon caveat
- [PAPER] Issue 9: Added [9, 29] citation on EO sentence in Introduction; added reference [29] (EO placeholder) — author must fill in exact title and Federal Register number
- [CODE+PAPER] Issue 1 (partial): Replaced fabricated demo sequence with PDB 7M5T (Anishchenko et al. 2021, Nature) — 100 AA de novo hallucinated protein, crystal-structure validated, no natural homolog. All Section 4.3 numbers now real: Gate alpha pLDDT mean 77.6 / 0% below threshold (ESMFold API); Gate beta GRAVY -0.667 / toxin_prob 0.130 / allergen_prob 0.000; Gate gamma HGT 3.28/100 / GC 0.530 / CAI 1.000 (E. coli optimised); TINSEL MINIMAL (16 bits, 96 carriers); SHA3-512 d06f9819...1e271 (128 chars). FASTA updated, reference [30] added, helper script fixed for pLDDT scale.

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
