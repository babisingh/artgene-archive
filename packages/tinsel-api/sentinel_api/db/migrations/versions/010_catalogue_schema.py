"""The catalogue: third-party published work, with attribution.

Adds the eleven tables described in ARCHITECTURE.md sections 4 and 8, joins
`certificates` to the shared `records` accession namespace, seeds the licence
vocabulary, installs the licence gate as a trigger, and adds one read view for
the registry page.

Two things are deliberately NOT here, although `alembic revision --autogenerate`
proposes them, because the ORM models have drifted from the migrations:

  * `op.drop_table("sequences")`. Migration 002 created it as a CRUD store that
    was never wired up. It has no model and no code reads it, so it is probably
    dead, but dropping a table is not a side effect to take on from a diff.
  * Dropping nine indexes, among them ix_certificates_sequence_hash, which
    backs the registration dedup lookup, and ix_fragment_kmer_hash, which backs
    the assembly-risk check. They exist because earlier migrations created them
    and the models never declared them. The models now declare them, so a later
    autogenerate is clean.

Revision ID: 010
Revises: 009
Create Date: 2026-11-12
"""

# ruff: noqa: E501  # table definitions are autogenerate output, kept verbatim
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '010'
down_revision: str | None = '009'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('ingest_runs',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('agent', sa.String(length=64), nullable=False, comment="e.g. 'genome-watch'"),
    sa.Column('instructions_sha3_256', sa.String(length=64), nullable=True),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('candidates_seen', sa.Integer(), nullable=True),
    sa.Column('records_created', sa.Integer(), nullable=True),
    sa.Column('log_url', sa.String(length=1024), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('licenses',
    sa.Column('spdx_id', sa.String(length=64), nullable=False, comment='SPDX identifier, or UNSTATED / PROPRIETARY'),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('url', sa.String(length=512), nullable=True),
    sa.Column('allows_redistribution', sa.Boolean(), nullable=False),
    sa.Column('allows_derivatives', sa.Boolean(), nullable=False),
    sa.Column('allows_commercial', sa.Boolean(), nullable=False),
    sa.Column('requires_attribution', sa.Boolean(), nullable=False),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint('spdx_id')
    )
    op.create_table('records',
    sa.Column('id', sa.String(length=20), nullable=False, comment='AG-YYYY-NNNNNN or AGC-YYYY-NNNNNN'),
    sa.Column('record_class', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("(record_class = 'certificate' AND id LIKE 'AG-%') OR (record_class = 'catalogue' AND id LIKE 'AGC-%')", name='ck_records_prefix_matches_class'),
    sa.CheckConstraint("record_class IN ('certificate', 'catalogue')", name='ck_records_class'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('design_metadata',
    sa.Column('record_id', sa.String(length=20), nullable=False),
    sa.Column('generating_model', sa.String(length=255), nullable=False),
    sa.Column('model_version', sa.String(length=64), nullable=True),
    sa.Column('model_availability', sa.String(length=32), nullable=True, comment='open | api | closed | not stated'),
    sa.Column('design_method', sa.Text(), nullable=True),
    sa.Column('design_target', sa.Text(), nullable=True),
    sa.Column('n_designed', sa.Integer(), nullable=True),
    sa.Column('n_tested', sa.Integer(), nullable=True),
    sa.Column('n_functional', sa.Integer(), nullable=True),
    sa.Column('assays', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('expression_host', sa.String(length=64), nullable=True),
    sa.Column('wet_lab_validated', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['record_id'], ['records.id'], ),
    sa.PrimaryKeyConstraint('record_id')
    )
    op.create_table('external_accessions',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('record_id', sa.String(length=20), nullable=False),
    sa.Column('database', sa.String(length=32), nullable=False),
    sa.Column('accession', sa.String(length=128), nullable=False),
    sa.Column('url', sa.String(length=1024), nullable=False),
    sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('resolves', sa.Boolean(), nullable=True),
    sa.CheckConstraint("database IN ('pdb', 'genbank', 'uniprot', 'ena', 'zenodo', 'figshare', 'supplementary', 'other')", name='ck_accession_database'),
    sa.ForeignKeyConstraint(['record_id'], ['records.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('record_id', 'database', 'accession', name='uq_accession_per_record')
    )
    op.create_table('record_gate_results',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('record_id', sa.String(length=20), nullable=False),
    sa.Column('gate_family', sa.String(length=20), nullable=False),
    sa.Column('gate_key', sa.String(length=32), nullable=False, comment="'1'..'7' | 'alpha'..'delta' | 'redistribution' | ..."),
    sa.Column('outcome', sa.String(length=16), nullable=False),
    sa.Column('detail', sa.Text(), nullable=True),
    sa.Column('evaluated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('evaluated_by', sa.String(length=128), nullable=False, comment="key id, 'agent:genome-watch', or 'human:<name>'"),
    sa.CheckConstraint("gate_family IN ('editorial', 'biosafety', 'license', 'attribution', 'integrity')", name='ck_gate_family'),
    sa.CheckConstraint("outcome IN ('pass', 'fail', 'warn', 'skip', 'advisory')", name='ck_gate_outcome'),
    sa.ForeignKeyConstraint(['record_id'], ['records.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('sources',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('doi', sa.String(length=255), nullable=True, comment='Canonical key when the work has one'),
    sa.Column('title', sa.Text(), nullable=False),
    sa.Column('container', sa.String(length=255), nullable=True, comment='Journal or preprint server'),
    sa.Column('published_on', sa.Date(), nullable=True),
    sa.Column('peer_reviewed', sa.Boolean(), nullable=False),
    sa.Column('version', sa.String(length=32), nullable=True, comment="'v1' for a preprint"),
    sa.Column('url', sa.String(length=1024), nullable=False),
    sa.Column('article_license', sa.String(length=64), nullable=True),
    sa.Column('data_license', sa.String(length=64), nullable=True),
    sa.Column('retrieved_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('retrieved_from', sa.String(length=1024), nullable=False, comment='The exact URL read'),
    sa.Column('content_sha3_256', sa.String(length=64), nullable=True),
    sa.ForeignKeyConstraint(['article_license'], ['licenses.spdx_id'], ),
    sa.ForeignKeyConstraint(['data_license'], ['licenses.spdx_id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('doi')
    )
    op.create_table('takedown_requests',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('record_id', sa.String(length=20), nullable=True),
    sa.Column('kind', sa.String(length=20), nullable=False),
    sa.Column('requested_by', sa.String(length=255), nullable=True),
    sa.Column('received_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('detail', sa.Text(), nullable=False),
    sa.Column('outcome', sa.String(length=20), nullable=True, comment='upheld | declined | partial'),
    sa.Column('action_taken', sa.Text(), nullable=True),
    sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    sa.CheckConstraint("kind IN ('license', 'privacy', 'biosafety', 'accuracy', 'other')", name='ck_takedown_kind'),
    sa.ForeignKeyConstraint(['record_id'], ['records.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('catalogue_records',
    sa.Column('id', sa.String(length=20), nullable=False),
    sa.Column('source_id', sa.UUID(), nullable=False),
    sa.Column('title', sa.Text(), nullable=False),
    sa.Column('molecule_type', sa.String(length=32), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('visibility', sa.String(length=20), nullable=False),
    sa.Column('hosting_decision', sa.String(length=20), nullable=False),
    sa.Column('hosting_reason', sa.Text(), nullable=False),
    sa.Column('biosafety_class', sa.String(length=20), nullable=False),
    sa.Column('ingest_run_id', sa.UUID(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
    sa.CheckConstraint("biosafety_class IN ('none', 'elevated', 'restricted')", name='ck_catalogue_biosafety_class'),
    sa.CheckConstraint("hosting_decision IN ('hosted', 'metadata_only', 'withheld')", name='ck_catalogue_hosting_decision'),
    sa.CheckConstraint("id LIKE 'AGC-%'", name='ck_catalogue_id_prefix'),
    sa.CheckConstraint("molecule_type IN ('protein', 'dna', 'rna', 'genome', 'regulatory_element', 'grna_scaffold')", name='ck_catalogue_molecule_type'),
    sa.CheckConstraint("status IN ('draft', 'staged', 'reviewed', 'published', 'restricted', 'withdrawn')", name='ck_catalogue_status'),
    sa.CheckConstraint("visibility IN ('private', 'public')", name='ck_catalogue_visibility'),
    sa.ForeignKeyConstraint(['id'], ['records.id'], ),
    sa.ForeignKeyConstraint(['ingest_run_id'], ['ingest_runs.id'], ),
    sa.ForeignKeyConstraint(['source_id'], ['sources.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('sequence_blobs',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('record_id', sa.String(length=20), nullable=False),
    sa.Column('accession_id', sa.UUID(), nullable=True),
    sa.Column('molecule_type', sa.String(length=32), nullable=False),
    sa.Column('length', sa.Integer(), nullable=False),
    sa.Column('sha3_256', sa.String(length=64), nullable=False),
    sa.Column('data', sa.Text(), nullable=True, comment='NULL for a metadata-only record'),
    sa.Column('license_spdx', sa.String(length=64), nullable=False),
    sa.Column('stored_because', sa.Text(), nullable=False),
    sa.Column('stored_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint("molecule_type IN ('protein', 'dna', 'rna', 'genome', 'regulatory_element', 'grna_scaffold')", name='ck_blob_molecule_type'),
    sa.CheckConstraint('length >= 0', name='ck_blob_length_non_negative'),
    sa.ForeignKeyConstraint(['accession_id'], ['external_accessions.id'], ),
    sa.ForeignKeyConstraint(['license_spdx'], ['licenses.spdx_id'], ),
    sa.ForeignKeyConstraint(['record_id'], ['records.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('source_authors',
    sa.Column('source_id', sa.UUID(), nullable=False),
    sa.Column('position', sa.SmallInteger(), nullable=False),
    sa.Column('full_name', sa.String(length=255), nullable=False),
    sa.Column('orcid', sa.String(length=32), nullable=True),
    sa.Column('affiliation', sa.Text(), nullable=True),
    sa.Column('is_corresponding', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['source_id'], ['sources.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('source_id', 'position')
    )
    # ── a warned certificate has never been storable ──────────────────────
    # Migration 001 created `status` as VARCHAR(20) while the ORM model declares
    # String(30), and nothing reconciled them. POST /register writes
    # CERTIFIED_WITH_WARNINGS, 23 characters, whenever the consequence pipeline
    # returns WARN rather than PASS, so every warned deposit failed with
    # `value too long for type character varying(20)` after the gates had run.
    # SQLAlchemy raised no objection because the model said 30, and the test
    # suite runs on SQLite, which ignores VARCHAR lengths altogether.
    #
    # This has to happen before registry_entries is created below: PostgreSQL
    # refuses to alter the type of a column a view depends on.
    op.alter_column(
        "certificates",
        "status",
        existing_type=sa.String(length=20),
        type_=sa.String(length=30),
        existing_nullable=False,
    )

    # ── certificates joins the shared accession namespace ──────────────────
    # Backfill before the foreign key, or it would reject every certificate
    # whose id has no records row. Anything already present is a certificate by
    # definition, and keeps its original timestamp.
    op.execute(
        "INSERT INTO records (id, record_class, created_at) "
        "SELECT id, 'certificate', created_at FROM certificates "
        "ON CONFLICT (id) DO NOTHING"
    )
    op.create_foreign_key(
        "fk_certificates_id_records", "certificates", "records", ["id"], ["id"]
    )
    op.create_check_constraint(
        "ck_certificates_id_prefix", "certificates", "id LIKE 'AG-%'"
    )

    # ── licence vocabulary ─────────────────────────────────────────────────
    op.execute(
        """
        INSERT INTO licenses (
            spdx_id, name, url, allows_redistribution, allows_derivatives,
            allows_commercial, requires_attribution, notes
        ) VALUES
            ('CC0-1.0', 'Creative Commons Zero v1.0 Universal', 'https://creativecommons.org/publicdomain/zero/1.0/', true, true, true, false, 'Public domain dedication.'),
            ('PUBLIC-DOMAIN', 'Public domain, no rights reserved', NULL, true, true, true, false, 'Use where a work is stated to be in the public domain without naming CC0.'),
            ('CC-BY-4.0', 'Creative Commons Attribution 4.0', 'https://creativecommons.org/licenses/by/4.0/', true, true, true, true, NULL),
            ('CC-BY-SA-4.0', 'Creative Commons Attribution-ShareAlike 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/', true, true, true, true, 'Redistribution must carry the same licence.'),
            ('MIT', 'MIT License', 'https://opensource.org/license/mit/', true, true, true, true, NULL),
            ('Apache-2.0', 'Apache License 2.0', 'https://www.apache.org/licenses/LICENSE-2.0', true, true, true, true, NULL),
            ('CC-BY-NC-4.0', 'Creative Commons Attribution-NonCommercial 4.0', 'https://creativecommons.org/licenses/by-nc/4.0/', false, true, false, true, 'Permits non-commercial redistribution. Held as non-redistributable until the operator determines whether this archive''s use is non-commercial.'),
            ('CC-BY-ND-4.0', 'Creative Commons Attribution-NoDerivatives 4.0', 'https://creativecommons.org/licenses/by-nd/4.0/', false, false, true, true, 'Permits verbatim redistribution, which a stored sequence arguably is. Held as non-redistributable pending that determination.'),
            ('CC-BY-NC-ND-4.0', 'Creative Commons Attribution-NonCommercial-NoDerivatives 4.0', 'https://creativecommons.org/licenses/by-nc-nd/4.0/', false, false, false, true, 'The commonest licence on a preprint. See the two notes above: conservative by default.'),
            ('PROPRIETARY', 'All rights reserved', NULL, false, false, false, true, NULL),
            ('UNSTATED', 'No licence stated', NULL, false, false, false, true, 'The commonest case. Raises a licence enquiry rather than closing the question.')
        """
    )

    # ── the licence gate ───────────────────────────────────────────────────
    # Enforced here rather than in Python so that no code path, present or
    # future, can store sequence data the licence does not cover. A
    # metadata-only record has data IS NULL and is always allowed.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION enforce_license_gate()
        RETURNS TRIGGER AS $$
        DECLARE permitted boolean;
        BEGIN
            IF NEW.data IS NULL THEN
                RETURN NEW;
            END IF;
            SELECT allows_redistribution INTO permitted
              FROM licenses WHERE spdx_id = NEW.license_spdx;
            IF NOT COALESCE(permitted, false) THEN
                RAISE EXCEPTION
                    'licence % does not permit redistribution: store the '
                    'accession and checksum only (record %)',
                    NEW.license_spdx, NEW.record_id;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        """
        CREATE TRIGGER sequence_blobs_license_gate
        BEFORE INSERT OR UPDATE ON sequence_blobs
        FOR EACH ROW EXECUTE FUNCTION enforce_license_gate();
        """
    )

    # ── one read view for the registry page ────────────────────────────────
    # Class table inheritance means a listing would otherwise need a three-way
    # join in the application. The view keeps that in one place and lets the
    # registry page and search query a single relation.
    op.execute(
        """
        CREATE VIEW registry_entries AS
        SELECT
            r.id,
            r.record_class,
            r.created_at,
            COALESCE(cr.title, c.owner_id)              AS title,
            COALESCE(cr.status, c.status)               AS status,
            COALESCE(cr.visibility, c.visibility)       AS visibility,
            COALESCE(cr.molecule_type, c.sequence_type) AS molecule_type,
            d.generating_model,
            d.wet_lab_validated,
            s.doi                                       AS source_doi,
            s.title                                     AS source_title
        FROM records r
        LEFT JOIN certificates      c  ON c.id         = r.id
        LEFT JOIN catalogue_records cr ON cr.id        = r.id
        LEFT JOIN design_metadata   d  ON d.record_id  = r.id
        LEFT JOIN sources           s  ON s.id         = cr.source_id;
        """
    )


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS registry_entries")
    op.execute("DROP TRIGGER IF EXISTS sequence_blobs_license_gate ON sequence_blobs")
    op.execute("DROP FUNCTION IF EXISTS enforce_license_gate()")

    # Narrowing status back to 20 would truncate any CERTIFIED_WITH_WARNINGS
    # row, silently turning "certified with warnings" into something shorter and
    # meaningless. Refuse with an explanation rather than letting PostgreSQL
    # raise a bare truncation error.
    warned = op.get_bind().execute(
        sa.text("SELECT count(*) FROM certificates WHERE length(status) > 20")
    ).scalar()
    if warned:
        raise RuntimeError(
            f"{warned} certificate(s) have a status longer than 20 characters, "
            "most likely CERTIFIED_WITH_WARNINGS. Narrowing certificates.status "
            "would truncate them. Resolve or remove those rows first."
        )

    op.alter_column(
        "certificates",
        "status",
        existing_type=sa.String(length=30),
        type_=sa.String(length=20),
        existing_nullable=False,
    )

    op.drop_constraint("ck_certificates_id_prefix", "certificates", type_="check")
    op.drop_constraint("fk_certificates_id_records", "certificates", type_="foreignkey")

    # Children before parents.
    op.drop_table("source_authors")
    op.drop_table("sequence_blobs")
    op.drop_table("record_gate_results")
    op.drop_table("external_accessions")
    op.drop_table("design_metadata")
    op.drop_table("takedown_requests")
    op.drop_table("catalogue_records")
    op.drop_table("sources")
    op.drop_table("licenses")
    op.drop_table("ingest_runs")
    op.drop_table("records")
