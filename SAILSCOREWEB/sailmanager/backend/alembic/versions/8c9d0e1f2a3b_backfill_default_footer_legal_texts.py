"""Backfill NULL footer legal texts with default English boilerplate.

Revision ID: 8c9d0e1f2a3b
Revises: e5f6a7b8c9d3
Create Date: 2026-03-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8c9d0e1f2a3b"
down_revision: Union[str, Sequence[str], None] = "e5f6a7b8c9d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from app.default_footer_legal_texts import (
        DEFAULT_FOOTER_COOKIE_POLICY_TEXT,
        DEFAULT_FOOTER_PRIVACY_POLICY_TEXT,
        DEFAULT_FOOTER_TERMS_OF_SERVICE_TEXT,
    )

    conn = op.get_bind()
    privacy = DEFAULT_FOOTER_PRIVACY_POLICY_TEXT
    terms = DEFAULT_FOOTER_TERMS_OF_SERVICE_TEXT
    cookie = DEFAULT_FOOTER_COOKIE_POLICY_TEXT

    for col, val in (
        ("footer_privacy_policy_text", privacy),
        ("footer_terms_of_service_text", terms),
        ("footer_cookie_policy_text", cookie),
    ):
        conn.execute(
            sa.text(f"UPDATE site_design SET {col} = :val WHERE {col} IS NULL"),
            {"val": val},
        )


def downgrade() -> None:
    pass
