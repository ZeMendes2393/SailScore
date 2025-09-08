# alembic/versions/0000_stub_add_incident_fields_to_protests.py
from alembic import op
import sqlalchemy as sa

# Este stub existe apenas para satisfazer referências antigas
revision = "add_incident_fields_to_protests"
down_revision = "ef919d399974"   # <- a migração que cria os protests
branch_labels = None
depends_on = None

def upgrade():
    # nada a fazer
    pass

def downgrade():
    # nada a fazer
    pass
