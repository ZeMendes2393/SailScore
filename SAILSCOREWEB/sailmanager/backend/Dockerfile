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
# UVICORN_WORKERS controla o número de workers uvicorn em produção (default: 2).
# Em Railway hobby/8GB plan, 2 workers cabem confortavelmente (~200-300MB total).
# Em planos com mais RAM, podes subir para 3 ou 4 via env var.
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${UVICORN_WORKERS:-2}"]
