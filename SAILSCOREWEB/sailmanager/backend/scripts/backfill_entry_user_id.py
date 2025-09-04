# scripts/backfill_entry_user_id.py
import os, sys

# garante que o Python vê a pasta "backend" como raiz do projeto
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.database import SessionLocal
from app import models

db = SessionLocal()

# 1) quantos estão sem user_id?
missing = db.query(models.Entry).filter(models.Entry.user_id.is_(None)).count()
print(f"Entries sem user_id: {missing}")

# 2) associar por email (case-insensitive)
rows = (
    db.query(models.Entry)
      .filter(models.Entry.user_id.is_(None), models.Entry.email.isnot(None))
      .all()
)

n = 0
for e in rows:
    email = (e.email or "").strip().lower()
    if not email:
        continue
    u = db.query(models.User).filter(models.User.email == email).first()
    if u:
        e.user_id = u.id
        n += 1

db.commit()
print(f"Atualizados {n} registos.")

# 3) amostra para conferência
sample = (
    db.query(models.Entry.id, models.Entry.email, models.Entry.user_id)
      .order_by(models.Entry.id)
      .limit(5)
      .all()
)
print("Sample:", sample)

db.close()
