#!/usr/bin/env python3
"""
Envia várias inscrições para POST /entries (mesmo endpoint do formulário online).

Requisitos:
  - API a correr (ex.: uvicorn).
  - Regata com online_entry_open=true.
- Se online entry limit estiver ativo, não exceder o limite.
  - Cada linha: class_name + boat_country_code + sail_number únicos na regata (regra do servidor).

Uso:
  python scripts/bulk_post_entries.py --file entries.json
  python scripts/bulk_post_entries.py --file entries.csv --api http://127.0.0.1:8000

JSON: array de objetos (campos EntryCreate), ou um único objeto.
CSV: primeira linha com cabeçalhos = nomes dos campos (regatta_id, class_name, boat_country_code,
     sail_number, email, first_name, last_name, ...).
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from pathlib import Path

import requests

# backend root no path (se correres a partir da pasta backend)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def load_payloads(path: Path) -> list[dict]:
    suffix = path.suffix.lower()
    if suffix == ".json":
        raw = path.read_text(encoding="utf-8")
        data = json.loads(raw)
        if isinstance(data, dict):
            return [data]
        if isinstance(data, list):
            return [x for x in data if isinstance(x, dict)]
        raise SystemExit("JSON tem de ser um objeto ou um array de objetos.")
    if suffix == ".csv":
        with path.open(newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            rows = []
            for row in reader:
                # normalizar chaves e converter tipos simples
                cleaned: dict = {}
                for k, v in row.items():
                    if k is None:
                        continue
                    key = (k or "").strip()
                    if not key or v is None or str(v).strip() == "":
                        continue
                    s = str(v).strip()
                    if key == "regatta_id":
                        cleaned[key] = int(s)
                    elif key in ("paid", "confirmed"):
                        cleaned[key] = s.lower() in ("1", "true", "yes", "sim")
                    elif key in ("rating", "orc_low", "orc_medium", "orc_high"):
                        try:
                            cleaned[key] = float(s.replace(",", "."))
                        except ValueError:
                            cleaned[key] = s
                    else:
                        cleaned[key] = s
                rows.append(cleaned)
            return rows
    raise SystemExit("Formato suportado: .json ou .csv")


def main() -> None:
    ap = argparse.ArgumentParser(description="Bulk POST /entries")
    ap.add_argument(
        "--api",
        default=os.environ.get("SAILSCORE_API", "http://127.0.0.1:8000").rstrip("/"),
        help="URL base da API (default: $SAILSCORE_API ou http://127.0.0.1:8000)",
    )
    ap.add_argument("--file", "-f", required=True, type=Path, help="entries.json ou entries.csv")
    ap.add_argument(
        "--stop-on-error",
        action="store_true",
        help="Parar após o primeiro erro HTTP",
    )
    args = ap.parse_args()

    if not args.file.is_file():
        raise SystemExit(f"Ficheiro não encontrado: {args.file}")

    payloads = load_payloads(args.file)
    url = f"{args.api}/entries"
    ok, fail = 0, 0

    for i, body in enumerate(payloads, start=1):
        try:
            r = requests.post(url, json=body, headers={"Content-Type": "application/json"}, timeout=60)
        except requests.RequestException as e:
            print(f"[{i}] ERRO rede: {e}")
            fail += 1
            if args.stop_on_error:
                raise SystemExit(1)
            continue

        if r.status_code in (200, 201):
            ok += 1
            try:
                data = r.json()
            except Exception:
                data = r.text
            print(f"[{i}] OK {r.status_code} — {data}")
        else:
            fail += 1
            print(f"[{i}] FALHA {r.status_code} — {r.text}")
            if args.stop_on_error:
                raise SystemExit(1)

    print(f"\nConcluído: {ok} ok, {fail} falhas.")


if __name__ == "__main__":
    main()
