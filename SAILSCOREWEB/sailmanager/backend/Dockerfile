# Railway usa este ficheiro em vez de Railpack quando existe na raiz do serviço (evita imagem antiga em cache).
FROM python:3.12-slim-bookworm

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# A Railway define PORT; localmente podes usar 8000.
# UVICORN_WORKERS controla o número de workers uvicorn em produção (default: 3).
# Com 3 workers: ~300-450MB total (memória OK em planos 512MB+).
# Pool DB: 20 conexões por worker × 3 = 60 (Postgres aceita 100).
# A outbox de emails arranca em apenas 1 worker (file lock em /tmp).
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${UVICORN_WORKERS:-3} --proxy-headers --forwarded-allow-ips='*'"]
