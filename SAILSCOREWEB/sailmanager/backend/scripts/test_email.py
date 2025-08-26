# scripts/test_email.py
from dotenv import load_dotenv
load_dotenv()  # <- carrega .env

from app.services.email import send_email

send_email(
    "qualquer@destinatario.com",
    "Teste SailScore",
    "<b>HTML OK</b><br>Se vês isto, o SMTP está a funcionar.",
    "Texto OK"
)
print("✔ Email de teste disparado")
