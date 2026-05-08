"""Armazena uploads em disco local ou S3."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from urllib.parse import quote, unquote, urlparse

logger = logging.getLogger("sailscore")


def use_s3() -> bool:
    return os.getenv("USE_S3", "").lower() in {"1", "true", "yes"}


def _bucket_name() -> str:
    return (os.getenv("S3_BUCKET") or os.getenv("AWS_S3_BUCKET") or "").strip()


def _region_name() -> str:
    return (os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "eu-north-1").strip()


def _s3_client():
    import boto3

    return boto3.client(
        "s3",
        region_name=_region_name(),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID") or None,
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY") or None,
    )


def save_binary_upload(
    subdir: str,
    filename: str,
    content: bytes,
    content_type: str,
    cache_control: str | None = None,
) -> str:
    """
    Grava ficheiro em uploads/<subdir>/ ou no bucket S3 com chave uploads/<subdir>/...

    Devolve URL usável no frontend: caminho /uploads/... ou URL HTTPS absoluta no S3.
    """
    relative = f"{subdir.strip().strip('/')}/{filename}"
    key = f"uploads/{relative}"

    if not use_s3():
        base = Path("uploads").resolve() / subdir
        base.mkdir(parents=True, exist_ok=True)
        (base / filename).write_bytes(content)
        return f"/uploads/{relative}"

    bucket = _bucket_name()
    region = _region_name()
    if not bucket:
        raise RuntimeError(
            "USE_S3 está ativo mas falta S3_BUCKET (ou AWS_S3_BUCKET) nas variáveis de ambiente."
        )

    from botocore.exceptions import BotoCoreError, ClientError

    client = _s3_client()
    put_args = {
        "Bucket": bucket,
        "Key": key,
        "Body": content,
        "ContentType": content_type,
    }
    if cache_control:
        put_args["CacheControl"] = cache_control
    try:
        client.put_object(**put_args)
    except (ClientError, BotoCoreError):
        logger.exception("Falha ao enviar objeto para S3 bucket=%s key=%s", bucket, key)
        raise

    safe_key = quote(key, safe="/")
    return f"https://{bucket}.s3.{region}.amazonaws.com/{safe_key}"


def save_image_upload(subdir: str, filename: str, content: bytes, content_type: str) -> str:
    """Compatibilidade com uploads de imagem existentes."""
    return save_binary_upload(
        subdir=subdir,
        filename=filename,
        content=content,
        content_type=content_type,
        cache_control="public, max-age=31536000",
    )


def _s3_key_from_public_url(url: str) -> str | None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return None
    bucket = _bucket_name()
    if not bucket:
        return None
    host = parsed.netloc.lower()
    if not host.startswith(f"{bucket.lower()}.s3."):
        return None
    return unquote(parsed.path.lstrip("/")) or None


def delete_stored_upload(stored_path: str) -> None:
    """Apaga ficheiro armazenado em S3 (URL) ou disco local (/uploads/...)."""
    if not stored_path:
        return

    if stored_path.startswith(("http://", "https://")) and use_s3():
        key = _s3_key_from_public_url(stored_path)
        if not key:
            return
        from botocore.exceptions import BotoCoreError, ClientError

        try:
            _s3_client().delete_object(Bucket=_bucket_name(), Key=key)
        except (ClientError, BotoCoreError):
            logger.exception("Falha ao remover objeto S3 key=%s", key)
        return

    fs_path = stored_path.replace("/uploads", "uploads")
    if os.path.exists(fs_path):
        try:
            os.remove(fs_path)
        except Exception:
            logger.exception("Falha ao remover ficheiro local fs_path=%s", fs_path)


def build_download_url(stored_path: str, download_filename: str | None = None, expires_seconds: int = 600) -> str | None:
    """Cria URL de download para S3; devolve None para ficheiros locais."""
    if not stored_path:
        return None
    if not stored_path.startswith(("http://", "https://")):
        return None
    if not use_s3():
        return stored_path

    key = _s3_key_from_public_url(stored_path)
    if not key:
        return stored_path

    from botocore.exceptions import BotoCoreError, ClientError

    params = {"Bucket": _bucket_name(), "Key": key}
    if download_filename:
        params["ResponseContentDisposition"] = f'attachment; filename="{download_filename}"'
    try:
        return _s3_client().generate_presigned_url(
            "get_object",
            Params=params,
            ExpiresIn=expires_seconds,
        )
    except (ClientError, BotoCoreError):
        logger.exception("Falha ao gerar URL assinada key=%s", key)
        return stored_path
