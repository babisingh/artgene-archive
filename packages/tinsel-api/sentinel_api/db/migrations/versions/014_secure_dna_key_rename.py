"""Rename the four secureDNA_* keys inside consequence_report->'gate2'.

`Gate2Result` is a pydantic model, so each attribute name is also the JSON key
it serialises to, and `routes/certificates.py` serves
`certificates.consequence_report` straight out of the JSONB column at four
endpoints without re-serialising it. The keys in the database are therefore the
client contract, which is why renaming the Python fields needs a data migration
and a dashboard release rather than a linter. See RENAME_PLAN.md.

Safe to do now, and expensive later: the registry holds no live AG-ID yet, so
this rewrites almost nothing. Once the paper cites a certificate the same
statement rewrites a published object.

Nothing here can affect certificate integrity. `consequence_report` is not
among the six fields `routes/register.py` passes to
`HybridCertificate.compute_hash`, and the audit chain hashes only
`(seq_num, prev_hash, cert_hash)`, so no digest covers these keys. There is no
trigger on `certificates` either; the append-only trigger is on
`registry_audit_log`.

The two statements are written out in full rather than generated. A JSON object
key cannot be a bind parameter in `jsonb_object_agg`'s CASE arms or in the `-`
operator, and building the SQL with f-strings would be both less readable and a
bandit B608 finding for no gain. Four keys do not need a loop.

Both directions are idempotent, preserve value types including nested hit
objects, leave every other key in `gate2` alone, skip rows with no `gate2`
block, and round-trip byte-identically.

Revision ID: 014
Revises: 013
Create Date: 2026-11-12
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "014"
down_revision: str | None = "013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_TO_SNAKE_CASE = sa.text(
    """
    UPDATE certificates
    SET consequence_report = jsonb_set(
            consequence_report,
            '{gate2}',
            (consequence_report -> 'gate2')
                - 'secureDNA_checked'
                - 'secureDNA_windows_screened'
                - 'secureDNA_hits'
                - 'secureDNA_status'
            || COALESCE(
                   (
                       SELECT jsonb_object_agg(
                                  CASE key
                                      WHEN 'secureDNA_checked'
                                          THEN 'secure_dna_checked'
                                      WHEN 'secureDNA_windows_screened'
                                          THEN 'secure_dna_windows_screened'
                                      WHEN 'secureDNA_hits'
                                          THEN 'secure_dna_hits'
                                      WHEN 'secureDNA_status'
                                          THEN 'secure_dna_status'
                                  END,
                                  value
                              )
                       FROM jsonb_each(consequence_report -> 'gate2')
                       WHERE key IN (
                           'secureDNA_checked',
                           'secureDNA_windows_screened',
                           'secureDNA_hits',
                           'secureDNA_status'
                       )
                   ),
                   '{}'::jsonb
               )
        )
    WHERE jsonb_typeof(consequence_report -> 'gate2') = 'object'
      AND (
          consequence_report -> 'gate2' ? 'secureDNA_checked'
       OR consequence_report -> 'gate2' ? 'secureDNA_windows_screened'
       OR consequence_report -> 'gate2' ? 'secureDNA_hits'
       OR consequence_report -> 'gate2' ? 'secureDNA_status'
      )
    """
)

_TO_ORIGINAL = sa.text(
    """
    UPDATE certificates
    SET consequence_report = jsonb_set(
            consequence_report,
            '{gate2}',
            (consequence_report -> 'gate2')
                - 'secure_dna_checked'
                - 'secure_dna_windows_screened'
                - 'secure_dna_hits'
                - 'secure_dna_status'
            || COALESCE(
                   (
                       SELECT jsonb_object_agg(
                                  CASE key
                                      WHEN 'secure_dna_checked'
                                          THEN 'secureDNA_checked'
                                      WHEN 'secure_dna_windows_screened'
                                          THEN 'secureDNA_windows_screened'
                                      WHEN 'secure_dna_hits'
                                          THEN 'secureDNA_hits'
                                      WHEN 'secure_dna_status'
                                          THEN 'secureDNA_status'
                                  END,
                                  value
                              )
                       FROM jsonb_each(consequence_report -> 'gate2')
                       WHERE key IN (
                           'secure_dna_checked',
                           'secure_dna_windows_screened',
                           'secure_dna_hits',
                           'secure_dna_status'
                       )
                   ),
                   '{}'::jsonb
               )
        )
    WHERE jsonb_typeof(consequence_report -> 'gate2') = 'object'
      AND (
          consequence_report -> 'gate2' ? 'secure_dna_checked'
       OR consequence_report -> 'gate2' ? 'secure_dna_windows_screened'
       OR consequence_report -> 'gate2' ? 'secure_dna_hits'
       OR consequence_report -> 'gate2' ? 'secure_dna_status'
      )
    """
)


def upgrade() -> None:
    op.execute(_TO_SNAKE_CASE)


def downgrade() -> None:
    op.execute(_TO_ORIGINAL)
