"""Fragment assembly utilities for biosafety risk detection.

Parses multi-FASTA input, detects directional overlaps between fragments
(minimum 20 AA/nt), and performs greedy assembly into contigs.

The assembled contigs are then screened through Gates 2+4 by the caller
to detect sequences that are individually harmless but dangerous when
assembled.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Fragment:
    header: str
    sequence: str  # upper-case amino-acid or nucleotide sequence


# ---------------------------------------------------------------------------
# FASTA parsing
# ---------------------------------------------------------------------------

def parse_multi_fasta(text: str, max_fragments: int = 50) -> list[Fragment]:
    """Parse a multi-FASTA string into Fragment objects.

    Raises ValueError if more than *max_fragments* are present or if no
    valid sequences are found.
    """
    fragments: list[Fragment] = []
    current_header: str | None = None
    current_parts: list[str] = []

    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith(">"):
            if current_header is not None:
                seq = "".join(current_parts).upper().replace(" ", "").replace("\t", "")
                if seq:
                    fragments.append(Fragment(header=current_header, sequence=seq))
            current_header = line[1:].strip() or f"fragment_{len(fragments) + 1}"
            current_parts = []
        else:
            current_parts.append(line)

    # flush last
    if current_header is not None:
        seq = "".join(current_parts).upper().replace(" ", "").replace("\t", "")
        if seq:
            fragments.append(Fragment(header=current_header, sequence=seq))

    # single bare sequence with no FASTA header
    if not fragments:
        bare = text.strip().upper().replace(" ", "").replace("\n", "")
        if bare:
            fragments.append(Fragment(header="fragment_1", sequence=bare))

    if not fragments:
        raise ValueError("No sequences found in input.")
    if len(fragments) > max_fragments:
        raise ValueError(
            f"Too many fragments: {len(fragments)} submitted, maximum is {max_fragments}."
        )

    return fragments


# ---------------------------------------------------------------------------
# Overlap detection
# ---------------------------------------------------------------------------

def _suffix_prefix_overlap(a: str, b: str, min_overlap: int) -> int | None:
    """Return the length of the longest suffix-of-a that equals a prefix-of-b.

    Returns ``None`` if no such overlap of at least *min_overlap* exists.
    """
    max_check = min(len(a), len(b))
    for ov in range(max_check, min_overlap - 1, -1):
        if a[-ov:] == b[:ov]:
            return ov
    return None


def find_overlaps(
    fragments: list[Fragment],
    min_overlap: int = 20,
) -> list[tuple[int, int, int]]:
    """Detect all directional overlaps between fragments.

    Returns a list of ``(i, j, overlap_len)`` tuples where the last
    *overlap_len* characters of ``fragments[i]`` equal the first
    *overlap_len* characters of ``fragments[j]``.
    """
    overlaps: list[tuple[int, int, int]] = []
    n = len(fragments)
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            ov = _suffix_prefix_overlap(
                fragments[i].sequence, fragments[j].sequence, min_overlap
            )
            if ov is not None:
                overlaps.append((i, j, ov))
    return overlaps


# ---------------------------------------------------------------------------
# Greedy assembly
# ---------------------------------------------------------------------------

def assemble(
    fragments: list[Fragment],
    overlaps: list[tuple[int, int, int]],
) -> list[str]:
    """Greedily assemble overlapping fragments into contig sequences.

    Uses a chain-building approach:
    1. Sort overlaps by length (longest first — prefer strong joins).
    2. Build adjacency: each fragment has at most one successor and one
       predecessor (simple linear chain, no branching).
    3. Walk each chain from its head to produce the assembled contig.

    Returns a list of assembled contig sequences (each longer than any
    individual fragment).  Fragments with no overlaps are not included.
    """
    if not overlaps:
        return []

    n = len(fragments)
    seqs = [f.sequence for f in fragments]

    # next_frag[i] = (j, overlap_len): fragment i is followed by fragment j
    next_frag: dict[int, tuple[int, int]] = {}
    has_predecessor: set[int] = set()

    # Greedily assign edges (longest overlap first, no conflicts)
    for i, j, ov in sorted(overlaps, key=lambda x: x[2], reverse=True):
        if i not in next_frag and j not in has_predecessor:
            next_frag[i] = (j, ov)
            has_predecessor.add(j)

    if not next_frag:
        return []

    # Walk chains starting from fragments with no predecessor
    contigs: list[str] = []
    visited: set[int] = set()

    chain_heads = [i for i in range(n) if i not in has_predecessor and i in next_frag]

    for head in chain_heads:
        if head in visited:
            continue
        contig = seqs[head]
        seen_in_chain: set[int] = {head}
        cur = head
        while cur in next_frag:
            nxt, ov = next_frag[cur]
            if nxt in seen_in_chain:
                break  # cycle guard
            contig += seqs[nxt][ov:]
            seen_in_chain.add(nxt)
            cur = nxt
        visited |= seen_in_chain
        if len(seen_in_chain) > 1:
            contigs.append(contig)

    return contigs
