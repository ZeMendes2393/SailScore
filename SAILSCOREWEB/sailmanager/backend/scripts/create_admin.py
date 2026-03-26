# scripts/create_admin.py
import os, sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.auth_helpers import make_unique_username
from app.database import SessionLocal, create_database
from app import models
from utils.auth_utils import hash_password


def main():
    create_database()
    db = SessionLocal()
    try:
        email = "admin@sailscore.app"  # <-- muda se quiseres
        name = "Admin"
        password = "TrocaIsto123!"  # <-- muda se quiseres

        org = db.query(models.Organization).filter(models.Organization.slug == "sailscore").first()
        if not org:
            print("Organização sailscore não existe. Corre as migrations.")
            return

        existing = (
            db.query(models.User)
            .filter(models.User.email == email, models.User.organization_id == org.id)
            .first()
        )
        if existing:
            print("Já existe um utilizador com esse email nesta organização.")
            return

        uname = make_unique_username(db, org.id, email.split("@")[0])
        u = models.User(
            organization_id=org.id,
            name=name,
            email=email,
            username=uname,
            hashed_password=hash_password(password),
            role="platform_admin",
            is_active=True,
        )
        db.add(u)
        db.commit()
        print("Platform admin criado:", email, "password:", password, "username:", uname)
    finally:
        db.close()


if __name__ == "__main__":
    main()
