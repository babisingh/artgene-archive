"""Invariants about the schema itself, checkable without a database.

These exist because of a bug that no other test could catch.
`certificates.status` was VARCHAR(20) in PostgreSQL while the ORM model
declared String(30), and POST /register writes
`CERTIFIED_WITH_WARNINGS`, which is 23 characters, whenever the consequence
pipeline returns WARN. Every warned deposit would have failed with a 500 after
the gates had run.

Two reasons it stayed hidden. SQLAlchemy had no objection, because the model
said 30. And the suite runs on SQLite, which accepts any length into a VARCHAR
column regardless of its declaration, so a passing test said nothing about
PostgreSQL.

The first class of test below is portable and guards the enum-outgrows-column
case. The model-versus-database case is caught by `alembic check` in CI, which
needs a real PostgreSQL and so cannot live here.
"""

from __future__ import annotations

import pytest
from sentinel_api.db.catalogue import (
    ACCESSION_DATABASES,
    BIOSAFETY_CLASSES,
    CATALOGUE_STATUSES,
    GATE_FAMILIES,
    GATE_OUTCOMES,
    HOSTING_DECISIONS,
    MOLECULE_TYPES,
    RECORD_CLASSES,
    TAKEDOWN_KINDS,
    CatalogueRecord,
    ExternalAccession,
    Record,
    RecordGateResult,
    SequenceBlob,
)
from sentinel_api.db.models import Certificate
from sqlalchemy import String
from tinsel.registry import CertificateStatus, HostOrganism, WatermarkTier


def _column_length(model: type, column_name: str) -> int:
    """Declared length of a String column on *model*, in characters."""
    column = model.__table__.columns[column_name]
    assert isinstance(column.type, String), f"{column_name} is not a String column"
    length = column.type.length
    assert length is not None, f"{column_name} has no declared length"
    return length


# Every (model, column, allowed values) pair where a value is written straight
# into a bounded VARCHAR. Add a row here whenever a vocabulary gains a column.
VOCABULARIES = [
    (Certificate, "status", tuple(s.value for s in CertificateStatus)),
    (Certificate, "tier", tuple(t.value for t in WatermarkTier)),
    (Certificate, "host_organism", tuple(h.value for h in HostOrganism)),
    (Certificate, "sequence_type", ("dna", "rna", "protein")),
    (Record, "record_class", RECORD_CLASSES),
    (CatalogueRecord, "status", CATALOGUE_STATUSES),
    (CatalogueRecord, "molecule_type", MOLECULE_TYPES),
    (CatalogueRecord, "hosting_decision", HOSTING_DECISIONS),
    (CatalogueRecord, "biosafety_class", BIOSAFETY_CLASSES),
    (SequenceBlob, "molecule_type", MOLECULE_TYPES),
    (RecordGateResult, "gate_family", GATE_FAMILIES),
    (RecordGateResult, "outcome", GATE_OUTCOMES),
    (ExternalAccession, "database", ACCESSION_DATABASES),
]


@pytest.mark.parametrize(
    ("model", "column_name", "values"),
    VOCABULARIES,
    ids=[f"{m.__name__}.{c}" for m, c, _ in VOCABULARIES],
)
def test_every_vocabulary_value_fits_its_column(
    model: type, column_name: str, values: tuple[str, ...]
) -> None:
    """No allowed value may exceed the column that stores it.

    The failure this guards against is silent on SQLite and a 500 on
    PostgreSQL, which is the worst possible split.
    """
    limit = _column_length(model, column_name)
    too_long = {v: len(v) for v in values if len(v) > limit}
    assert not too_long, (
        f"{model.__name__}.{column_name} is String({limit}) but these values "
        f"do not fit: {too_long}. Widen the column in a migration."
    )


def test_warned_certificate_status_is_the_longest_case() -> None:
    """Pin the specific value that was broken, so the regression is named."""
    assert CertificateStatus.CERTIFIED_WITH_WARNINGS.value == "CERTIFIED_WITH_WARNINGS"
    assert len(CertificateStatus.CERTIFIED_WITH_WARNINGS.value) == 23
    assert _column_length(Certificate, "status") >= 23


def test_takedown_kinds_are_a_closed_set() -> None:
    """The CHECK constraints are built from these tuples, so they must be stable."""
    assert TAKEDOWN_KINDS == ("license", "privacy", "biosafety", "accuracy", "other")


def test_record_prefixes_are_mutually_exclusive() -> None:
    """AGC- must not satisfy the AG- prefix test, or the classes could blur.

    SQL `LIKE 'AG-%'` requires a literal hyphen third, which 'AGC-' fails. This
    asserts the same thing in Python so the intent is recorded next to the
    constraint rather than only inside it.
    """
    certificate_id = "AG-2026-000001"
    catalogue_id = "AGC-2026-000001"
    assert certificate_id.startswith("AG-")
    assert not catalogue_id.startswith("AG-")
    assert catalogue_id.startswith("AGC-")
