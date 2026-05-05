#!/usr/bin/env python3
"""Compute real gate outputs for the GLP-1 demo sequence.

Usage
-----
    python scripts/compute_real_gate_outputs.py

Requires network access for the ESMFold API call (Gate alpha).
Gates beta and gamma run locally from the FASTA sequence.

Output is printed as a JSON block ready to paste into Section 4.3 and Figure 2.
"""

import json
import hashlib
import sys
import urllib.request
import urllib.error

# ── GLP-1 sequence ───────────────────────────────────────────────────────────
FASTA_PATH = "packages/tinsel-demo/sequences/01_glp1_pass.fasta"


def load_sequence(path: str) -> tuple[str, str]:
    """Return (header, sequence) from a FASTA file."""
    with open(path) as f:
        lines = f.read().splitlines()
    header = lines[0].lstrip(">")
    sequence = "".join(l.strip() for l in lines[1:] if l.strip())
    return header, sequence


# ── Gate beta: GRAVY score (Kyte & Doolittle, 1982) ─────────────────────────
KD = {
    'A': 1.8, 'R': -4.5, 'N': -3.5, 'D': -3.5, 'C': 2.5,
    'Q': -3.5, 'E': -3.5, 'G': -0.4, 'H': -3.2, 'I': 4.5,
    'L': 3.8, 'K': -3.9, 'M': 1.9, 'F': 2.8, 'P': -1.6,
    'S': -0.8, 'T': -0.7, 'W': -0.9, 'Y': -1.3, 'V': 4.2,
}


def gravy(seq: str) -> float:
    vals = [KD[aa] for aa in seq.upper() if aa in KD]
    return round(sum(vals) / len(vals), 3) if vals else 0.0


# ── Gate beta: simple cationic toxin / allergen heuristics ──────────────────
def toxin_probability(seq: str) -> float:
    """Rough cationic toxin score: fraction of K+R residues."""
    s = seq.upper()
    return round(sum(s.count(aa) for aa in 'KR') / len(s), 3) if s else 0.0


def allergen_probability(seq: str) -> float:
    """Rough allergen proxy: cysteine fraction (common in disulfide-rich allergens)."""
    s = seq.upper()
    return round(s.count('C') / len(s), 3) if s else 0.0


# ── Gate gamma: GC content estimate ─────────────────────────────────────────
def estimate_gc_ecoli(seq: str) -> float:
    """Estimate GC content using E. coli mean codon GC fractions per amino acid."""
    ecoli_gc = {
        'A': 0.667, 'R': 0.444, 'N': 0.333, 'D': 0.333, 'C': 0.333,
        'Q': 0.333, 'E': 0.333, 'G': 0.667, 'H': 0.333, 'I': 0.222,
        'L': 0.444, 'K': 0.333, 'M': 0.333, 'F': 0.222, 'P': 0.556,
        'S': 0.444, 'T': 0.444, 'W': 0.333, 'Y': 0.222, 'V': 0.333,
    }
    vals = [ecoli_gc[aa] for aa in seq.upper() if aa in ecoli_gc]
    return round(sum(vals) / len(vals), 3) if vals else 0.0


# ── Synonymous carrier codon count (TINSEL tier) ─────────────────────────────
# Met (M) and Trp (W) have only one codon each — not carrier positions.
_NO_SYNONYMS = frozenset('MW')


def count_carrier_codons(seq: str) -> int:
    return sum(1 for aa in seq.upper() if aa.isalpha() and aa not in _NO_SYNONYMS)


def tinsel_tier(n: int) -> tuple[str, int]:
    if n < 16:   return "NONE", 0
    if n < 64:   return "DEMO", 16
    if n < 128:  return "MINIMAL", 32
    if n < 256:  return "STANDARD", 64
    return "FULL", 128


# ── ESMFold API (Gate alpha) ─────────────────────────────────────────────────
ESMFOLD_API = "https://api.esmatlas.com/foldSequence/v1/pdb/"


def call_esmfold(sequence: str) -> dict | None:
    """Call ESMFold API and return pLDDT stats, or None on failure."""
    data = sequence.encode()
    req = urllib.request.Request(
        ESMFOLD_API,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            pdb_text = resp.read().decode()
        plddt_values = []
        seen_residues: set[tuple[str, int]] = set()
        for line in pdb_text.splitlines():
            if line.startswith("ATOM"):
                chain = line[21]
                resnum = int(line[22:26].strip())
                key = (chain, resnum)
                if key not in seen_residues:
                    seen_residues.add(key)
                    try:
                        plddt_values.append(float(line[60:66].strip()))
                    except ValueError:
                        pass
        if not plddt_values:
            print("WARNING: No pLDDT values parsed from ESMFold PDB output", file=sys.stderr)
            return None
        mean_plddt = round(sum(plddt_values) / len(plddt_values), 1)
        pct_below_50 = round(100 * sum(1 for v in plddt_values if v < 50) / len(plddt_values), 1)
        return {"plddt_mean": mean_plddt, "pct_below_50": pct_below_50}
    except urllib.error.URLError as e:
        print(f"ESMFold API error: {e}", file=sys.stderr)
        return None


# ── SHA3-512 hash ─────────────────────────────────────────────────────────────
def sha3_512_hex(seq: str) -> str:
    return hashlib.sha3_512(seq.upper().encode()).hexdigest()


# ── Main ─────────────────────────────────────────────────────────────────────
def main() -> None:
    header, seq = load_sequence(FASTA_PATH)
    print(f"Loaded: {header}")
    print(f"Length: {len(seq)} AA\n")

    gravy_val   = gravy(seq)
    toxin_prob  = toxin_probability(seq)
    allergen_pr = allergen_probability(seq)
    gc          = estimate_gc_ecoli(seq)
    carriers    = count_carrier_codons(seq)
    tier, bits  = tinsel_tier(carriers)
    h           = sha3_512_hex(seq)

    print(f"Gate beta  — GRAVY: {gravy_val}  toxin_prob: {toxin_prob}  allergen_prob: {allergen_pr}")
    print(f"Gate gamma — estimated GC (E. coli codon weights): {gc}")
    print(f"             NOTE: run real codon optimizer for actual HGT/CAI values")
    print(f"TINSEL     — carrier codons: {carriers}  tier: {tier}  watermark bits: {bits}")
    print(f"\nSHA3-512 (128-char hex):\n{h}\n")

    print("Calling ESMFold API (may take 30-120 s)...")
    esmfold = call_esmfold(seq)
    if esmfold:
        print(f"Gate alpha — pLDDT mean: {esmfold['plddt_mean']}  pct_below_50: {esmfold['pct_below_50']}%")
        alpha_status = "PASS" if esmfold["pct_below_50"] < 20 else "FAIL"
    else:
        print("Gate alpha — ESMFold API unreachable; replace REPLACE_WITH_REAL manually")
        esmfold = {"plddt_mean": "REPLACE_WITH_REAL", "pct_below_50": "REPLACE_WITH_REAL"}
        alpha_status = "REPLACE_WITH_REAL"

    result = {
        "sequence_length_aa": len(seq),
        "sequence_hash_sha3_512": h,
        "gate_alpha": {
            "plddt_mean": esmfold["plddt_mean"],
            "pct_below_50": esmfold["pct_below_50"],
            "threshold_pct_below_50": 20,
            "status": alpha_status,
        },
        "gate_beta": {
            "gravy": gravy_val,
            "toxin_prob": toxin_prob,
            "allergen_prob": allergen_pr,
            "status": "PASS" if toxin_prob < 0.30 and allergen_pr < 0.40 else "WARN/FAIL",
        },
        "gate_gamma": {
            "gc_content_ecoli_estimate": gc,
            "cai": "REPLACE — run real codon optimizer (e.g. python-codon-tables + Sharp & Li 1987)",
            "hgt_score": "REPLACE — run adapters/gate3/codon.py on real DNA sequence",
        },
        "tinsel": {
            "carrier_codons": carriers,
            "tier": tier,
            "watermark_bits": bits,
        },
    }

    print("\n=== RESULT JSON (paste into Section 4.3 / Figure 2) ===")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
