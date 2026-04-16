"""Enforce append-only on registry_audit_log at the database level.

Adds a PostgreSQL trigger that raises an exception on any UPDATE or DELETE
against registry_audit_log.  This makes the ORM-level AppendOnlyMixin
enforcement durable against direct SQL writes, DBA access, and future
migrations that bypass the ORM.

Revision ID: 003
Revises: 002
Create Date: 2026-04-16 00:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "003"
down_revision: str | None = "002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Trigger function — raises on any mutation attempt.
    op.execute("""
        CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION
                'registry_audit_log is append-only: UPDATE and DELETE are not permitted. '
                'Attempted operation: % on row seq_num=%',
                TG_OP, OLD.seq_num;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Trigger fires BEFORE UPDATE or DELETE on any row.
    op.execute("""
        CREATE TRIGGER audit_log_immutable
        BEFORE UPDATE OR DELETE ON registry_audit_log
        FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS audit_log_immutable ON registry_audit_log;")
    op.execute("DROP FUNCTION IF EXISTS prevent_audit_log_mutation();")
