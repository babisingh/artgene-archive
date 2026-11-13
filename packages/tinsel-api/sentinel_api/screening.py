"""Biosafety screening, shared by every route that accepts a sequence.

Two routes take sequences: ``/register``, the original watermark deposit, and
``/submissions``, direct submission to the catalogue. Both must read, limit and
screen a sequence in exactly the same way, so that logic lives here once rather
than twice. A change to how a sequence is classified or screened belongs in this
module and nowhere else: two copies of biosafety logic drift apart, and the gap
between them is where something gets through.
"""

from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tinsel.consequence import ConsequenceReport
from tinsel.models import GateStatus, SequenceType
from tinsel.sequence.fasta import normalise
from tinsel.sequence.translate import analyse as analyse_nucleotide
from tinsel.sequence.translate import six_frame_orfs, to_dna
from tinsel_gates.nucleotide import run_nucleotide_pipeline
from tinsel_gates.pipeline import run_consequence_pipeline

from sentinel_api.db.catalogue import SequenceBlob
from sentinel_api.db.models import Certificate, FragmentKmerIndex

# Length limits by what is actually being screened, rather than one cap over
# everything. The old single 5,000 "AA" limit was applied to nucleotides too,
# which is both the wrong unit and the wrong number.
#: Longest protein accepted. Above ESMFold Atlas's 400 residue ceiling the
#: structural gate falls back to a mock, which the response says.
MAX_PROTEIN_RESIDUES = 2_000
#: Longest coding sequence: three bases per residue, plus a stop codon.
MAX_CDS_NUCLEOTIDES = MAX_PROTEIN_RESIDUES * 3 + 3
#: Longest non-coding submission. Genome scale on purpose: a designed phage
#: genome is roughly forty thousand bases.
MAX_NUCLEOTIDES = 50_000

KMER_SIZE = 20
KMER_STEP = 3  # stride: balances index size against detection sensitivity
KMER_MAX_LEN = 1_500  # only synthesis-scale fragments are indexed


class ScreeningInputError(ValueError):
    """The input cannot be screened at all.

    ``detail`` is exactly what the register route has always returned for this
    failure, kept so that route's responses do not change shape.
    """

    def __init__(self, code: str, message: str, detail: Any) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.detail = detail


@dataclass
class Prepared:
    """A sequence read and classified, ready to screen."""

    sequence: str
    seq_type: SequenceType
    screen_mode: str  # protein | cds | nucleotide
    gate_protein: str
    coding_dna: str
    orfs: list = field(default_factory=list)

    @property
    def sha3_256(self) -> str:
        """Deduplication digest: the sequence exactly as submitted, uppercased."""
        return hashlib.sha3_256(self.sequence.upper().encode()).hexdigest()


def prepare(fasta: str) -> Prepared:
    """Read a FASTA string and decide how it can be screened.

    The pipeline documents that its ``dna`` argument must translate to its
    ``protein`` argument, so no protein is ever invented. Three cases:

    * ``protein``: the submission is a protein, and all four gates apply.
    * ``cds``: a single clean reading frame, translated, then all four gates.
    * ``nucleotide``: no single product, so the protein gates run over the six
      reading frames and the structural gate does not run at all.

    ``sequence`` stays exactly as submitted, and is what gets hashed.
    """
    try:
        _header, sequence, seq_type = normalise(fasta)
    except ValueError as exc:
        raise ScreeningInputError("INVALID_FASTA", str(exc), str(exc)) from exc

    orfs: list = []
    if seq_type is SequenceType.PROTEIN:
        screen_mode = "protein"
        gate_protein = sequence
        coding_dna = ""
        limit, units, measured = MAX_PROTEIN_RESIDUES, "residues", len(sequence)
    else:
        coding_dna = to_dna(sequence)
        analysis = analyse_nucleotide(sequence)
        if analysis.is_cds:
            screen_mode = "cds"
            gate_protein = analysis.protein or ""
            limit, units, measured = MAX_CDS_NUCLEOTIDES, "bases", len(coding_dna)
        else:
            screen_mode = "nucleotide"
            # The longest reading frame stands in wherever one protein is
            # needed, which is the k-mer index and the fragment cross-check.
            orfs = six_frame_orfs(coding_dna)
            gate_protein = orfs[0].protein if orfs else ""
            limit, units, measured = MAX_NUCLEOTIDES, "bases", len(coding_dna)

    if measured > limit:
        message = (
            f"Sequence length {measured:,} {units} exceeds the maximum "
            f"of {limit:,} {units} for a {screen_mode} submission."
        )
        raise ScreeningInputError(
            "SEQUENCE_TOO_LONG",
            message,
            {"code": "SEQUENCE_TOO_LONG", "message": message, "screen_mode": screen_mode},
        )

    return Prepared(sequence, seq_type, screen_mode, gate_protein, coding_dna, orfs)


# ---------------------------------------------------------------------------
# Fragment assembly: two harmless pieces that join into something harmful
# ---------------------------------------------------------------------------


def kmer_hashes(sequence: str) -> set[str]:
    """SHA3-256 hashes of every overlapping 20-mer, at a stride of three."""
    seq = sequence.upper()
    return {
        hashlib.sha3_256(seq[i : i + KMER_SIZE].encode()).hexdigest()
        for i in range(0, len(seq) - KMER_SIZE + 1, KMER_STEP)
    }


def add_kmer_index_rows(
    db: AsyncSession,
    registry_id: str,
    org_id: uuid.UUID | None,
    sequence: str,
) -> None:
    """Index *sequence* so later sequences are checked against it.

    ``org_id`` is None for a direct submission, which belongs to no
    organisation. Rows are added to the session, not committed.
    """
    if len(sequence) > KMER_MAX_LEN:
        return
    for h in kmer_hashes(sequence):
        db.add(
            FragmentKmerIndex(
                id=uuid.uuid4(), registry_id=registry_id, org_id=org_id, kmer_hash=h
            )
        )


async def _archived_protein(db: AsyncSession, registry_id: str) -> str:
    """The protein an archived record stands for, wherever that record lives.

    A certificate keeps it in its watermark metadata. A direct submission keeps
    only the sequence, in sequence_blobs, so the protein is derived from it the
    same way it was when the submission was screened. Without this second
    branch, nothing submitted directly would ever be cross-checked again.
    """
    cert = (
        await db.execute(select(Certificate).where(Certificate.id == registry_id))
    ).scalars().first()
    if cert is not None:
        return (cert.watermark_metadata or {}).get("original_protein", "")

    data = (
        await db.execute(
            select(SequenceBlob.data)
            .where(SequenceBlob.record_id == registry_id, SequenceBlob.data.is_not(None))
            .limit(1)
        )
    ).scalar_one_or_none()
    if not data:
        return ""
    try:
        return prepare(f">archived\n{data}").gate_protein
    except ScreeningInputError:
        return ""


async def fragment_assembly_risk(db: AsyncSession, protein: str, env: str) -> bool:
    """True if *protein* and an archived sequence assemble into a failing product.

    Never reveals which archived sequence was involved: callers get a boolean.
    """
    if len(protein) > KMER_MAX_LEN:
        return False
    hashes = kmer_hashes(protein)
    if not hashes:
        return False

    matching_ids = [
        row[0]
        for row in (
            await db.execute(
                select(FragmentKmerIndex.registry_id)
                .where(FragmentKmerIndex.kmer_hash.in_(list(hashes)))
                .distinct()
                .limit(10)
            )
        ).fetchall()
    ]
    if not matching_ids:
        return False

    from tinsel.fragment import Fragment, assemble, find_overlaps

    for registry_id in matching_ids:
        archived = await _archived_protein(db, registry_id)
        if not archived or archived.upper() == protein.upper():
            continue
        frags = [Fragment("new", protein), Fragment("archived", archived)]
        overlaps = find_overlaps(frags, min_overlap=KMER_SIZE)
        if not overlaps:
            continue
        for contig in assemble(frags, overlaps):
            report = await run_consequence_pipeline(
                protein=contig, dna="", env=env, run_gates=(2, 4)
            )
            if report.overall_status == GateStatus.FAIL:
                return True
    return False


# ---------------------------------------------------------------------------
# The gates
# ---------------------------------------------------------------------------


async def run_pipeline(
    prepared: Prepared, host_organism: str, env: str
) -> ConsequenceReport:
    """Run the biosafety gates appropriate to how the sequence was read."""
    if prepared.screen_mode == "nucleotide":
        return await run_nucleotide_pipeline(
            prepared.coding_dna, env=env, host_organism=host_organism
        )
    return await run_consequence_pipeline(
        protein=prepared.gate_protein,
        dna=prepared.coding_dna,
        env=env,
        host_organism=host_organism,
    )


def partial_screen_note(report: ConsequenceReport) -> str | None:
    """Why a report must not read as a clean screen, or None if it can.

    Two ways a gate silently does not run: the structure predictor refuses
    sequences over 400 residues and the adapter substitutes a placeholder, and
    a nucleotide submission can have more reading frames than the screen covers.
    """
    if report.gate1 is not None and report.gate1.mock_fallback:
        return (
            "the structural gate did not run, because this sequence is longer "
            "than the structure predictor accepts, so its confidence figures "
            "are placeholders."
        )
    if report.orf_screen is not None and not report.orf_screen.complete:
        return report.orf_screen.note
    return None


#: How each screening outcome is recorded on a catalogue record.
OUTCOME_BIOSAFETY_CLASS = {
    "passed": "none",
    "passed_with_notes": "elevated",
    "withheld": "restricted",
}


@dataclass
class ScreenResult:
    """The outcome of screening one sequence.

    ``outcome`` is passed, passed_with_notes or withheld. A partial screen is
    never reported as a pass: it is passed_with_notes, so a person looks at it.
    """

    outcome: str
    report: dict | None
    note: str | None = None
    fragment_risk: bool = False

    @property
    def biosafety_class(self) -> str:
        return OUTCOME_BIOSAFETY_CLASS[self.outcome]


async def screen(
    db: AsyncSession, prepared: Prepared, host_organism: str, env: str
) -> ScreenResult:
    """Screen a prepared sequence: fragment cross-check, then every gate."""
    if prepared.gate_protein and await fragment_assembly_risk(
        db, prepared.gate_protein, env
    ):
        return ScreenResult("withheld", None, None, fragment_risk=True)

    report = await run_pipeline(prepared, host_organism, env)
    note = partial_screen_note(report)
    if report.overall_status == GateStatus.FAIL:
        return ScreenResult("withheld", report.model_dump())
    if report.overall_status == GateStatus.WARN or note:
        return ScreenResult("passed_with_notes", report.model_dump(), note)
    return ScreenResult("passed", report.model_dump())
