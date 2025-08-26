# scripts/create_admin.py
import os, sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database import SessionLocal, create_database
from app import models
from utils.auth_utils import hash_password

def main():
    create_database()
    db = SessionLocal()
    try:
        email = "admin@sailscore.app"   # <-- muda se quiseres
        name = "Admin"
        password = "TrocaIsto123!"      # <-- muda se quiseres

        existing = db.query(models.User).filter(models.User.email == email).first()
        if existing:
            print("Já existe um utilizador com esse email.")
            return

        u = models.User(
            name=name,
            email=email,
            hashed_password=hash_password(password),
            role="admin",
            is_active=True
        )
        db.add(u)
        db.commit()
        print("Admin criado:", email, "password:", password)
    finally:
        db.close()

if __name__ == "__main__":
    main()
