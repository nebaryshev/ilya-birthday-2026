#!/usr/bin/env python3
"""Generate short-lived, tightly scoped Yandex Object Storage upload forms."""

from __future__ import annotations

import base64
import getpass
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path


REGION = "ru-central1"
SERVICE = "s3"
DEFAULT_BUCKET = "ilya-birthday-2026-media"


def sign(key: bytes, value: str) -> bytes:
    return hmac.new(key, value.encode("utf-8"), hashlib.sha256).digest()


def signing_key(secret: str, date_stamp: str) -> bytes:
    date_key = sign(("AWS4" + secret).encode("utf-8"), date_stamp)
    region_key = sign(date_key, REGION)
    service_key = sign(region_key, SERVICE)
    return sign(service_key, "aws4_request")


def create_form(
    *,
    bucket: str,
    key: str,
    access_key: str,
    secret_key: str,
    now: datetime,
    expires_at: datetime,
    max_size: int,
    content_type_prefix: str,
) -> dict:
    date_stamp = now.strftime("%Y%m%d")
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    credential = f"{access_key}/{date_stamp}/{REGION}/{SERVICE}/aws4_request"
    fields = {
        "key": key,
        "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
        "X-Amz-Credential": credential,
        "X-Amz-Date": amz_date,
        "success_action_status": "204",
    }
    conditions = [
        {"bucket": bucket},
        {"key": key},
        {"X-Amz-Algorithm": fields["X-Amz-Algorithm"]},
        {"X-Amz-Credential": credential},
        {"X-Amz-Date": amz_date},
        {"success_action_status": "204"},
        ["content-length-range", 1, max_size],
        ["starts-with", "$Content-Type", content_type_prefix],
    ]
    policy_document = {
        "expiration": expires_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "conditions": conditions,
    }
    policy = base64.b64encode(
        json.dumps(policy_document, separators=(",", ":")).encode("utf-8")
    ).decode("ascii")
    signature = hmac.new(
        signing_key(secret_key, date_stamp), policy.encode("ascii"), hashlib.sha256
    ).hexdigest()
    fields["Policy"] = policy
    fields["X-Amz-Signature"] = signature
    return {
        "url": f"https://storage.yandexcloud.net/{bucket}",
        "fields": fields,
    }


def main() -> None:
    print("Данные используются только локально и не сохраняются в проекте.")
    bucket = input(f"Название бакета [{DEFAULT_BUCKET}]: ").strip() or DEFAULT_BUCKET
    access_key = input("Access Key ID: ").strip()
    secret_key = getpass.getpass("Secret Access Key (ввод не отображается): ").strip()
    days_text = input("Сколько дней разрешать загрузку [7]: ").strip()
    days = int(days_text or "7")
    if not access_key or not secret_key:
        raise SystemExit("Access Key ID и Secret Access Key обязательны")
    if days < 1 or days > 30:
        raise SystemExit("Укажите срок от 1 до 30 дней")

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=days)
    common = {
        "bucket": bucket,
        "access_key": access_key,
        "secret_key": secret_key,
        "now": now,
        "expires_at": expires_at,
    }
    uploads = {}
    for memory_id in range(1, 11):
        uploads[f"videos/{memory_id:02d}"] = create_form(
            **common,
            key=f"videos/{memory_id:02d}",
            max_size=100 * 1024 * 1024,
            content_type_prefix="video/",
        )
        uploads[f"covers/{memory_id:02d}"] = create_form(
            **common,
            key=f"covers/{memory_id:02d}",
            max_size=20 * 1024 * 1024,
            content_type_prefix="image/",
        )
    uploads["data/memories.json"] = create_form(
        **common,
        key="data/memories.json",
        max_size=256 * 1024,
        content_type_prefix="application/json",
    )

    config = {
        "bucket": bucket,
        "publicBase": f"https://storage.yandexcloud.net/{bucket}",
        "expiresAt": expires_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "uploads": uploads,
    }
    output = Path(__file__).resolve().parents[1] / "dist" / "upload-config.js"
    output.write_text(
        "window.ILYA_UPLOAD_CONFIG = "
        + json.dumps(config, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )
    print(f"Готово: {output}")
    print(f"Загрузка разрешена до {config['expiresAt']}")


if __name__ == "__main__":
    main()
