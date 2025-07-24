"""add results table"""
from alembic import op
import sqlalchemy as sa

revision = '8b275a46eb39'
down_revision = '3d6fd3b22a5f'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # A tabela 'results' já existe na base de dados, portanto não vamos criá-la novamente
    pass
