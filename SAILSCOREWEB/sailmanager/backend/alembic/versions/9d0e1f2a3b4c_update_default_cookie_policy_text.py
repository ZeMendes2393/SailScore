"""Replace previous boilerplate cookie policy with no-tracking wording.

Revision ID: 9d0e1f2a3b4c
Revises: 8c9d0e1f2a3b
Create Date: 2026-03-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9d0e1f2a3b4c"
down_revision: Union[str, Sequence[str], None] = "8c9d0e1f2a3b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Previous default (must match DB rows filled by 8c9d0e1f2a3b + app default).
_OLD_COOKIE = (
    "This website may use cookies to support essential functionality and improve the user experience. "
    "Cookies may be used to remember preferences, support navigation, and help the website operate correctly. "
    "By continuing to use the website, users acknowledge the use of cookies in accordance with "
    "the club\u2019s settings and policies."
)

_NEW_COOKIE = (
    "This website does not use cookies for tracking or advertising purposes. "
    "It may use essential cookies for basic functionality, such as session cookies, "
    "which are necessary for the website to work properly. "
    "These cookies are temporary and do not store any personal data."
)


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "UPDATE site_design SET footer_cookie_policy_text = :new "
            "WHERE footer_cookie_policy_text = :old"
        ),
        {"new": _NEW_COOKIE, "old": _OLD_COOKIE},
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "UPDATE site_design SET footer_cookie_policy_text = :old "
            "WHERE footer_cookie_policy_text = :new"
        ),
        {"old": _OLD_COOKIE, "new": _NEW_COOKIE},
    )
