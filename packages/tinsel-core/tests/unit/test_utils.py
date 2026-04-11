"""Unit tests for tinsel.utils (15 tests)."""

import numpy as np
import pytest
from tinsel.utils import (
    complement,
    gc_content,
    mean_plddt,
    molecular_weight,
    plddt_to_bfactor,
    reverse_complement,
    translate,
)

# ---------------------------------------------------------------------------
# complement
# ---------------------------------------------------------------------------

def test_complement_basic():
    assert complement("ATCG") == "TAGC"


def test_complement_with_n():
    assert complement("ATCGN") == "TAGCN"


def test_complement_lowercase_preserved():
    assert complement("atcg") == "tagc"


# ---------------------------------------------------------------------------
# reverse_complement
# ---------------------------------------------------------------------------

def test_reverse_complement_basic():
    assert reverse_complement("ATCG") == "CGAT"


def test_reverse_complement_palindrome():
    # AATT is its own reverse complement
    assert reverse_complement("AATT") == "AATT"


# ---------------------------------------------------------------------------
# gc_content
# ---------------------------------------------------------------------------

def test_gc_content_all_gc():
    assert gc_content("GCGC") == pytest.approx(1.0)


def test_gc_content_no_gc():
    assert gc_content("ATAT") == pytest.approx(0.0)


def test_gc_content_mixed():
    assert gc_content("ATGC") == pytest.approx(0.5)


def test_gc_content_empty_sequence():
    assert gc_content("") == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# translate
# ---------------------------------------------------------------------------

def test_translate_basic():
    # ATG = M, GGT = G, TAA = stop
    assert translate("ATGGGT") == "MG"


def test_translate_with_stop_codon():
    protein = translate("ATGTAA")
    assert protein == "M*"


def test_translate_incomplete_trailing_codon_ignored():
    # 7 bases: ATG + GGT + A  → only two complete codons
    assert translate("ATGGGTA") == "MG"


# ---------------------------------------------------------------------------
# molecular_weight
# ---------------------------------------------------------------------------

def test_molecular_weight_single_aa():
    # Glycine: 57.02146 + water 18.01056 = 75.03202
    mw = molecular_weight("G")
    assert mw == pytest.approx(75.03202, rel=1e-4)


def test_molecular_weight_dipeptide():
    # Ala-Gly: 71.03711 + 57.02146 + 18.01056 = 146.06913
    mw = molecular_weight("AG")
    assert mw == pytest.approx(146.06913, rel=1e-4)


# ---------------------------------------------------------------------------
# mean_plddt / plddt_to_bfactor
# ---------------------------------------------------------------------------

def test_mean_plddt_basic():
    assert mean_plddt([80.0, 90.0, 70.0]) == pytest.approx(80.0)


def test_mean_plddt_empty_list():
    assert mean_plddt([]) == 0.0


def test_plddt_to_bfactor_returns_ndarray():
    arr = plddt_to_bfactor([70.0, 85.0, 92.5])
    assert isinstance(arr, np.ndarray)
    assert arr.dtype == float
    assert arr[1] == pytest.approx(85.0)
