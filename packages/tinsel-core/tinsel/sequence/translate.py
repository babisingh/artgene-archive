"""Translation and classification of nucleotide sequences.

``run_consequence_pipeline`` has always documented that its ``dna`` argument
"must translate to *protein*", but the registration route passed the nucleotide
string as both. Gate alpha therefore ran ESMFold against a string of A, C, G
and T and returned a confidence score for a protein that does not exist. A
meaningless number is worse than no number, because it can produce a spurious
pass.

The fix needs a real translation, and an honest answer for the sequences that
have none. A designed genome, a promoter, a gRNA scaffold and a multi-gene
construct are all nucleotide sequences with no single protein product, so there
is nothing to fold and nothing to compare. Those are classified here rather
than translated badly.
"""

from __future__ import annotations

from dataclasses import dataclass

#: Standard genetic code, DNA codons to one-letter amino acids, '*' for stop.
CODON_TABLE: dict[str, str] = {
    "TTT": "F", "TTC": "F", "TTA": "L", "TTG": "L",
    "CTT": "L", "CTC": "L", "CTA": "L", "CTG": "L",
    "ATT": "I", "ATC": "I", "ATA": "I", "ATG": "M",
    "GTT": "V", "GTC": "V", "GTA": "V", "GTG": "V",
    "TCT": "S", "TCC": "S", "TCA": "S", "TCG": "S",
    "CCT": "P", "CCC": "P", "CCA": "P", "CCG": "P",
    "ACT": "T", "ACC": "T", "ACA": "T", "ACG": "T",
    "GCT": "A", "GCC": "A", "GCA": "A", "GCG": "A",
    "TAT": "Y", "TAC": "Y", "TAA": "*", "TAG": "*",
    "CAT": "H", "CAC": "H", "CAA": "Q", "CAG": "Q",
    "AAT": "N", "AAC": "N", "AAA": "K", "AAG": "K",
    "GAT": "D", "GAC": "D", "GAA": "E", "GAG": "E",
    "TGT": "C", "TGC": "C", "TGA": "*", "TGG": "W",
    "CGT": "R", "CGC": "R", "CGA": "R", "CGG": "R",
    "AGT": "S", "AGC": "S", "AGA": "R", "AGG": "R",
    "GGT": "G", "GGC": "G", "GGA": "G", "GGG": "G",
}

_COMPLEMENT = str.maketrans("ACGTN", "TGCAN")

#: Shortest sequence treated as a candidate coding sequence. Ten codons is
#: already generous for anything that would be called a designed protein, and
#: the floor stops a short oligo being translated into a meaningless peptide.
MIN_CDS_NUCLEOTIDES = 30

#: Classifications.
CDS = "cds"
NON_CODING = "non_coding"


@dataclass(frozen=True)
class NucleotideAnalysis:
    """What a nucleotide sequence is, and its protein if it has one.

    Attributes
    ----------
    kind:
        ``cds`` when the sequence is a clean single open reading frame, in which
        case ``protein`` holds its translation. ``non_coding`` otherwise, in
        which case ``protein`` is None, deliberately: there is no protein, and
        inventing one is what the old code did.
    reason:
        Why, in words. Returned to the depositor, so "not a multiple of three"
        is more use than a refusal with no explanation.
    """

    kind: str
    protein: str | None
    reason: str

    @property
    def is_cds(self) -> bool:
        return self.kind == CDS


def to_dna(sequence: str) -> str:
    """Uppercase, and read RNA as DNA so one code table serves both."""
    return sequence.upper().replace("U", "T")


def reverse_complement(dna: str) -> str:
    """Reverse complement of a DNA sequence."""
    return to_dna(dna).translate(_COMPLEMENT)[::-1]


def translate(dna: str, *, stop_at_stop: bool = True) -> str:
    """Translate *dna* in frame 0.

    Unknown codons, which is to say any containing N, become ``X`` rather than
    raising, so a sequence with a few ambiguous bases still yields a usable
    translation and the ambiguity stays visible in the output.
    """
    seq = to_dna(dna)
    residues: list[str] = []
    for index in range(0, len(seq) - 2, 3):
        codon = seq[index : index + 3]
        residue = CODON_TABLE.get(codon, "X")
        if residue == "*" and stop_at_stop:
            break
        residues.append(residue)
    return "".join(residues)


def analyse(sequence: str) -> NucleotideAnalysis:
    """Classify *sequence* and translate it if it is a clean single reading frame.

    The test for "clean" is deliberately strict, because the consequence of a
    false positive is a protein gate run against a translation nobody intended:
    a length divisible by three, an ATG start, no internal stop, and no
    ambiguous residues. Anything else is non-coding as far as this archive is
    concerned, which is a statement about what can be screened rather than a
    claim about biology.
    """
    seq = to_dna(sequence)

    if len(seq) < MIN_CDS_NUCLEOTIDES:
        return NucleotideAnalysis(
            NON_CODING,
            None,
            f"Shorter than {MIN_CDS_NUCLEOTIDES} bases, so not treated as a "
            "coding sequence.",
        )
    if len(seq) % 3 != 0:
        return NucleotideAnalysis(
            NON_CODING,
            None,
            f"Length {len(seq)} is not a multiple of three, so there is no "
            "single reading frame to translate.",
        )
    if not seq.startswith("ATG"):
        return NucleotideAnalysis(
            NON_CODING,
            None,
            "Does not begin with ATG, so no start codon to translate from.",
        )

    # Translate the whole thing, stops included, so an internal stop is visible
    # rather than silently truncating the protein.
    full = translate(seq, stop_at_stop=False)
    body, trailing_stop = (full[:-1], True) if full.endswith("*") else (full, False)

    if "*" in body:
        position = body.index("*") + 1
        return NucleotideAnalysis(
            NON_CODING,
            None,
            f"Internal stop codon at residue {position}, so this is not one "
            "open reading frame. A multi-gene construct or a genome belongs in "
            "the catalogue rather than being folded as a single protein.",
        )
    if "X" in body:
        return NucleotideAnalysis(
            NON_CODING,
            None,
            "Contains ambiguous bases that do not resolve to an amino acid, so "
            "the translation would be unreliable.",
        )
    if not body:
        return NucleotideAnalysis(
            NON_CODING, None, "Translates to an empty protein."
        )

    suffix = " with a terminal stop codon" if trailing_stop else ""
    return NucleotideAnalysis(
        CDS,
        body,
        f"Single open reading frame of {len(body)} residues{suffix}.",
    )


# ---------------------------------------------------------------------------
# Six-frame open reading frames
#
# A designed genome, a plasmid or a promoter has no single protein product, so
# there is nothing to fold. That does not mean it cannot be screened. The
# hazard in a nucleotide sequence is usually a protein it encodes somewhere,
# in any of six frames, on either strand, and that is what synthetic DNA
# screening actually looks for.
#
# Extracting ORFs and screening each one is therefore the nucleotide analogue
# of the protein gates, not a weaker substitute for them.
# ---------------------------------------------------------------------------

#: Shortest peptide treated as a candidate gene product. Sixty residues is the
#: conventional floor for ORF calling: shorter windows appear by chance in any
#: sequence of reasonable length and would swamp the screen with noise.
MIN_ORF_RESIDUES = 60


@dataclass(frozen=True)
class OpenReadingFrame:
    """One candidate protein encoded somewhere in a nucleotide sequence."""

    protein: str
    strand: str  # "+" or "-"
    frame: int   # 0, 1 or 2, the offset within that strand
    start: int   # nucleotide offset of the first base, on the given strand

    @property
    def label(self) -> str:
        return f"{self.strand}{self.frame}@{self.start}"


def six_frame_orfs(
    sequence: str, *, min_residues: int = MIN_ORF_RESIDUES
) -> list[OpenReadingFrame]:
    """Return the open reading frames of *sequence*, longest first.

    Reads all three frames of both strands. An ORF here runs from an ATG to the
    next in-frame stop codon, which is the inclusive definition: it finds a
    hazardous product whether or not the submitter intended it to be expressed,
    which is the point of screening rather than of annotation.

    Returned longest first, because a caller that can only afford to screen
    some of them should screen the ones most likely to be real genes.
    """
    seq = to_dna(sequence)
    found: list[OpenReadingFrame] = []

    for strand, strand_seq in (("+", seq), ("-", reverse_complement(seq))):
        for frame in range(3):
            index = frame
            limit = len(strand_seq) - 2
            while index < limit:
                if strand_seq[index : index + 3] != "ATG":
                    index += 3
                    continue

                residues: list[str] = []
                cursor = index
                while cursor < limit:
                    residue = CODON_TABLE.get(strand_seq[cursor : cursor + 3], "X")
                    if residue == "*":
                        break
                    residues.append(residue)
                    cursor += 3

                if len(residues) >= min_residues:
                    found.append(
                        OpenReadingFrame(
                            protein="".join(residues),
                            strand=strand,
                            frame=frame,
                            start=index,
                        )
                    )
                # Continue past this ORF rather than past this codon: nested
                # downstream ATGs inside the same frame describe the same gene
                # product, and screening truncations of it adds cost and no
                # information.
                index = max(cursor + 3, index + 3)

    found.sort(key=lambda orf: len(orf.protein), reverse=True)
    return found
