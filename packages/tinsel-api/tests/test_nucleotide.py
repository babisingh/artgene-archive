"""Nucleotide submissions: translation, reading frames, and honest screening.

Three things are being pinned down.

A coding sequence is translated, and the gates see the protein it encodes
rather than a string of A, C, G and T. The structure predictor used to be
handed the nucleotide string and returned a confidence score for a protein
that does not exist, which is worse than no score because it can pass.

A nucleotide sequence with no single product is not refused. A designed genome,
a plasmid or a promoter has a hazard only if it encodes one somewhere, so the
protein gates run over the six-frame reading frames and the structural gate is
not run at all. Refusing to look would be the worse answer.

A screen that could not cover everything says so. A bounded ORF screen and a
mocked structural gate both produce a certificate with warnings rather than a
clean one.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient
from tinsel.models import GateStatus
from tinsel.sequence.translate import (
    CODON_TABLE,
    analyse,
    reverse_complement,
    six_frame_orfs,
    translate,
)
from tinsel_gates.adapters.gate2.mock import MockGate2Adapter
from tinsel_gates.adapters.gate4.mock import MockGate4Adapter
from tinsel_gates.nucleotide import run_nucleotide_pipeline


def recode(dna: str) -> str:
    """Return a synonymous recoding of *dna*: same protein, different codons.

    Codon aware on purpose. A plain string replace crosses codon boundaries and
    silently changes the protein, which is how the first version of this test
    managed to fail.
    """
    synonyms: dict[str, list[str]] = {}
    for codon, residue in CODON_TABLE.items():
        synonyms.setdefault(residue, []).append(codon)

    out: list[str] = []
    for index in range(0, len(dna), 3):
        codon = dna[index : index + 3]
        if len(codon) < 3:
            out.append(codon)
            continue
        options = [c for c in synonyms[CODON_TABLE[codon]] if c != codon]
        # Leave the start codon alone: ATG is the only methionine codon, and
        # analyse() requires the sequence to begin with it.
        out.append(options[0] if options and index > 0 else codon)
    return "".join(out)


# A clean coding sequence: ATG, 80 sense codons, one terminal stop.
CDS = "ATG" + "GCTAAATTAGGCTGCCAT" * 12 + "TAA"
# The same construct hidden on the reverse strand of something non-coding.
NON_CODING = "GGCCATATTAGGCC" * 4 + reverse_complement(CDS) + "TTACGCGCGATAT" * 4


class TestTranslation:
    def test_translates_a_known_codon_run(self) -> None:
        assert translate("ATGGCTTGTGGA") == "MACG"

    def test_stops_at_a_stop_codon(self) -> None:
        assert translate("ATGGCTTAAGGC") == "MA"

    def test_reverse_complement_round_trips(self) -> None:
        assert reverse_complement(reverse_complement(CDS)) == CDS

    def test_rna_is_read_as_dna(self) -> None:
        assert translate("AUGGCUUGU") == translate("ATGGCTTGT")


class TestClassification:
    def test_a_clean_reading_frame_is_a_cds(self) -> None:
        result = analyse(CDS)
        assert result.is_cds
        assert result.protein == translate(CDS)
        assert result.protein is not None and result.protein.startswith("M")
        # The terminal stop is not part of the protein.
        assert "*" not in result.protein

    @pytest.mark.parametrize(
        ("sequence", "expected_in_reason"),
        [
            ("ATGGCT", "Shorter than"),
            ("ATG" + "GCT" * 15 + "A", "multiple of three"),
            ("GGG" + "GCT" * 15, "ATG"),
            ("ATG" + "GCT" * 8 + "TAA" + "GCT" * 8, "Internal stop"),
            ("ATG" + "GCN" * 15, "ambiguous"),
        ],
    )
    def test_everything_else_is_non_coding_with_a_reason(
        self, sequence: str, expected_in_reason: str
    ) -> None:
        """The reason is returned to the depositor, so it has to be specific."""
        result = analyse(sequence)
        assert not result.is_cds
        assert expected_in_reason in result.reason


class TestOpenReadingFrames:
    def test_finds_a_gene_on_the_reverse_strand(self) -> None:
        """The case that matters: a hazard on the strand nobody looked at."""
        expected = translate(CDS)
        orfs = six_frame_orfs(NON_CODING)
        assert any(orf.protein == expected for orf in orfs)
        assert any(orf.strand == "-" for orf in orfs)

    def test_respects_the_minimum_length(self) -> None:
        assert six_frame_orfs(NON_CODING, min_residues=10_000) == []

    def test_longest_first(self) -> None:
        orfs = six_frame_orfs(NON_CODING, min_residues=5)
        lengths = [len(o.protein) for o in orfs]
        assert lengths == sorted(lengths, reverse=True)


class TestNucleotidePipeline:
    async def test_the_structural_gate_is_never_run(self) -> None:
        """There is nothing to fold, so nothing is pretended."""
        report = await run_nucleotide_pipeline(NON_CODING, env="test")
        assert report.gate1 is None
        assert 1 not in report.run_gates

    async def test_a_sequence_with_no_reading_frame_says_so(self) -> None:
        report = await run_nucleotide_pipeline("ACGT" * 100, env="test")
        assert report.run_gates == (3,)
        assert report.orf_screen is not None
        assert report.orf_screen.orfs_found == 0
        assert report.orf_screen.complete is True
        assert "no encoded protein to screen" in report.orf_screen.note

    async def test_a_hazard_in_any_frame_fails_the_whole_submission(self) -> None:
        """One bad reading frame is enough. This is the point of the screen."""
        report = await run_nucleotide_pipeline(
            NON_CODING,
            env="test",
            gate2_adapter=MockGate2Adapter(toxin_probability=0.99),
        )
        assert report.overall_status == GateStatus.FAIL
        assert report.orf_screen is not None
        assert report.orf_screen.worst_orf is not None

    async def test_a_bounded_screen_cannot_be_clean(self) -> None:
        """More frames than the screen covers means warnings, not a pass."""
        report = await run_nucleotide_pipeline(
            NON_CODING, env="test", min_orf_residues=5, max_orfs=1
        )
        assert report.orf_screen is not None
        assert report.orf_screen.complete is False
        assert report.overall_status == GateStatus.WARN
        assert "partial screen" in report.orf_screen.note

    async def test_a_failure_survives_an_incomplete_screen(self) -> None:
        """Finding a hazard is a finding, however much was left unchecked."""
        report = await run_nucleotide_pipeline(
            NON_CODING,
            env="test",
            min_orf_residues=5,
            max_orfs=1,
            gate4_adapter=MockGate4Adapter(max_similarity=0.99),
        )
        assert report.overall_status == GateStatus.FAIL


class TestRegistration:
    async def _register(self, client: AsyncClient, auth_headers: dict, fasta: str):
        return await client.post(
            "/api/v1/register",
            json={
                "fasta": fasta,
                "owner_id": "OWNER_NT",
                "ethics_code": "ERC-NT",
                "host_organism": "ECOLI",
            },
            headers=auth_headers,
        )

    async def test_a_coding_sequence_is_translated_before_screening(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await self._register(client, auth_headers, f">cds\n{CDS}")
        assert resp.status_code == 201, resp.text
        registry_id = resp.json()["registry_id"]

        record = await client.get(
            f"/api/v1/certificates/{registry_id}", headers=auth_headers
        )
        metadata = record.json()["watermark_metadata"]
        assert metadata["screen_mode"] == "cds"
        # The gates saw the protein, and the submission was kept as submitted.
        assert metadata["original_protein"] == translate(CDS)
        assert metadata["submitted_sequence"] == CDS
        assert metadata["submitted_type"] == "dna"

    async def test_a_non_coding_sequence_is_screened_not_refused(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await self._register(client, auth_headers, f">construct\n{NON_CODING}")
        assert resp.status_code == 201, resp.text
        registry_id = resp.json()["registry_id"]

        record = await client.get(
            f"/api/v1/certificates/{registry_id}", headers=auth_headers
        )
        body = record.json()
        assert body["watermark_metadata"]["screen_mode"] == "nucleotide"
        report = body["consequence_report"]
        assert report["gate1"] is None
        assert report["orf_screen"]["orfs_found"] >= 1

    async def test_two_codings_of_the_same_protein_are_both_accepted(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        """Deduplication is on the submission, not on the translation.

        Two coding sequences for one protein are different objects: the TINSEL
        watermark lives in the codon choices, so collapsing them would discard
        the thing the registry exists to record.
        """
        first = await self._register(client, auth_headers, f">a\n{CDS}")
        assert first.status_code == 201, first.text

        synonymous = recode(CDS)
        assert translate(synonymous) == translate(CDS)
        assert synonymous != CDS

        second = await self._register(client, auth_headers, f">b\n{synonymous}")
        assert second.status_code == 201, second.text
        assert second.json()["registry_id"] != first.json()["registry_id"]

    async def test_an_overlong_protein_is_refused_in_residues(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await self._register(client, auth_headers, ">p\n" + "ACDEFGHIKL" * 250)
        assert resp.status_code == 422
        detail = resp.json()["detail"]
        assert detail["code"] == "SEQUENCE_TOO_LONG"
        assert "residues" in detail["message"]
        assert detail["screen_mode"] == "protein"

    async def test_an_overlong_nucleotide_is_refused_in_bases(
        self, client: AsyncClient, auth_headers: dict
    ) -> None:
        resp = await self._register(client, auth_headers, ">g\n" + "ACGTTT" * 9_000)
        assert resp.status_code == 422
        detail = resp.json()["detail"]
        assert detail["code"] == "SEQUENCE_TOO_LONG"
        assert "bases" in detail["message"]
        assert detail["screen_mode"] == "nucleotide"
