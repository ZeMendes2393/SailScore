import os, smtplib, ssl
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv()

HOST = os.getenv("SMTP_HOST")
PORT = int(os.getenv("SMTP_PORT", "2525"))
USER = os.getenv("SMTP_USER")
PASS = os.getenv("SMTP_PASS")
FROM = os.getenv("SMTP_FROM_EMAIL", "no-reply@mail.sailscore.app")
TO   = os.getenv("SMTP_TEST_TO", FROM)  # opcional: define no .env um email teu
SUBJ = "SMTP smoketest SailScore"
BODY = "Olá! Este é um teste simples de SMTP."

print(f"HOST={HOST} PORT={PORT} USER={USER!r}")

msg = EmailMessage()
msg["From"] = FROM
msg["To"] = TO
msg["Subject"] = SUBJ
msg.set_content(BODY)

try:
    if PORT == 465:
        server = smtplib.SMTP_SSL(HOST, PORT, timeout=10)
    else:
        server = smtplib.SMTP(HOST, PORT, timeout=10)
        server.set_debuglevel(1)  # mostra o diálogo SMTP
        server.ehlo()
        server.starttls(context=ssl.create_default_context())
        server.ehlo()

    server.login(USER, PASS)
    server.send_message(msg)
    server.quit()
    print("✓ Enviado com sucesso via SMTP.")
except Exception as e:
    print("✗ Falhou:", repr(e))
