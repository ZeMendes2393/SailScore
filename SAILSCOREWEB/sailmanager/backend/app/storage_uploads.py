"""Grava ficheiros de media do painel (logos, hero, etc.): disco local ou S3."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from urllib.parse import quote

logger = logging.getLogger("sailscore")


def use_s3() -> bool:
    return os.getenv("USE_S3", "").lower() in {"1", "true", "yes"}


def save_image_upload(
    subdir: str,
    filename: str,
    content: bytes,
    content_type: str,
) -> str:
    """
    Grava imagem em uploads/<subdir>/ ou no bucket S3 com chave uploads/<subdir>/...

    Devolve URL usável no frontend: caminho /uploads/... ou URL HTTPS absoluta no S3.
    """
    relative = f"{subdir.strip().strip('/')}/{filename}"
    key = f"uploads/{relative}"

    if not use_s3():
        base = Path("uploads").resolve() / subdir
        base.mkdir(parents=True, exist_ok=True)
        (base / filename).write_bytes(content)
        return f"/uploads/{relative}"

    bucket = (
        os.getenv("S3_BUCKET")
        or os.getenv("AWS_S3_BUCKET")
        or ""
    ).strip()
    region = (
        os.getenv("AWS_REGION")
        or os.getenv("AWS_DEFAULT_REGION")
        or "eu-north-1"
    ).strip()
    if not bucket:
        raise RuntimeError(
            "USE_S3 está ativo mas falta S3_BUCKET (ou AWS_S3_BUCKET) nas variáveis de ambiente."
        )

    import boto3
    from botocore.exceptions import BotoCoreError, ClientError

    client = boto3.client(
        "s3",
        region_name=region,
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID") or None,
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY") or None,
    )
    try:
        client.put_object(
            Bucket=bucket,
            Key=key,
            Body=content,
            ContentType=content_type,
            CacheControl="public, max-age=31536000",
        )
    except (ClientError, BotoCoreError):
        logger.exception("Falha ao enviar objeto para S3 bucket=%s key=%s", bucket, key)
        raise

    safe_key = quote(key, safe="/")
    return f"https://{bucket}.s3.{region}.amazonaws.com/{safe_key}"
