"""Add sequences table for tinsel_api CRUD store.

Revision ID: 002
Revises: 001
Create Date: 2027-01-01 00:00:01.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: str | None = "001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sequences",
        sa.Column("id", sa.String(255), nullable=False),
        sa.Column("sequence", sa.Text, nullable=False),
        sa.Column("seq_type", sa.String(10), nullable=False),
        sa.Column("description", sa.String(1000), nullable=True),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("sequences")
