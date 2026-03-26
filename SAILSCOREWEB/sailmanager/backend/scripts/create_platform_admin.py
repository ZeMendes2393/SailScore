#!/usr/bin/env python3
"""
Cria ou atualiza uma conta platform_admin (acesso a todas as organizações).
Uso: python scripts/create_platform_admin.py EMAIL PASSWORD
Exemplo: python scripts/create_platform_admin.py jose.mendes2691@gmail.com Optimist2691
"""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.auth_helpers import make_unique_username
from app.database import SessionLocal, create_database
from app import models
from utils.auth_utils import hash_password


def main():
    if len(sys.argv) < 3:
        print("Uso: python create_platform_admin.py EMAIL PASSWORD")
        print("Exemplo: python create_platform_admin.py jose.mendes2691@gmail.com MinhaPassword123")
        sys.exit(1)

    email = sys.argv[1].strip().lower()
    password = sys.argv[2]

    create_database()
    db = SessionLocal()
    try:
        org = db.query(models.Organization).filter(models.Organization.slug == "sailscore").first()
        if not org:
            print("Organização sailscore não existe. Corre as migrations primeiro.")
            sys.exit(1)

        existing = (
            db.query(models.User)
            .filter(models.User.email == email, models.User.organization_id == org.id)
            .first()
        )

        if existing:
            existing.hashed_password = hash_password(password)
            existing.role = "platform_admin"
            existing.is_active = True
            db.commit()
            print(f"Conta atualizada: {email} (platform_admin) — password alterada.")
        else:
            uname = make_unique_username(db, org.id, email.split("@")[0])
            u = models.User(
                organization_id=org.id,
                name=email.split("@")[0],
                email=email,
                username=uname,
                hashed_password=hash_password(password),
                role="platform_admin",
                is_active=True,
            )
            db.add(u)
            db.commit()
            print(f"Platform admin criado: {email} | username: {uname}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
