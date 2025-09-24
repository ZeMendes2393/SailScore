from __future__ import annotations

from datetime import datetime
from pathlib import Path
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Protest, ProtestAttachment
from app.schemas import ProtestDecisionIn
from utils.auth_utils import get_current_user, verify_role
from .helpers import PUBLIC_BASE_URL, tiny_valid_pdf_bytes, generate_decision_pdf, normalize_public_url

router = APIRouter()

@router.patch("/{protest_id}/decision", dependencies=[Depends(verify_role(["admin"]))])
def save_decision(
    regatta_id: int,
    protest_id: int,
    decision: ProtestDecisionIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    p = (
        db.query(Protest)
        .filter(Protest.id == protest_id, Protest.regatta_id == regatta_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Protest not found")

    p.decision_json = decision.model_dump()
    if isinstance(p.decision_json, dict):
        p.decision_json.setdefault("regatta_id", regatta_id)

    p.decided_at = datetime.utcnow()
    p.decided_by_user_id = current_user.id
    db.add(p)
    db.commit()
    db.refresh(p)

    # PDF + attachment
    try:
        public_url: Optional[str] = None
        file_path: Optional[Path] = None
        written_ok = False

        if generate_decision_pdf:
            try:
                ret = generate_decision_pdf(regatta_id, p.id, p.decision_json or {})
                if isinstance(ret, (list, tuple)) and len(ret) >= 2:
                    file_path, public_url = Path(ret[0]) if ret[0] else None, ret[1]
                else:
                    file_path, public_url = None, ret  # type: ignore[assignment]
                if file_path and file_path.exists() and file_path.stat().st_size > 0:
                    written_ok = True
                public_url = normalize_public_url(public_url)
            except Exception as e:
                print("[PDF][decision] serviço falhou, fallback:", e)
                public_url = None
                file_path = None

        if not written_ok:
            uploads_dir = Path("uploads") / "protests" / str(p.regatta_id)
            uploads_dir.mkdir(parents=True, exist_ok=True)
            file_path = uploads_dir / f"decision_{p.id}.pdf"
            file_path.write_bytes(tiny_valid_pdf_bytes("Decision", f"Protest ID: {p.id}"))
            public_url = f"{PUBLIC_BASE_URL}/uploads/protests/{p.regatta_id}/decision_{p.id}.pdf"

        p.decision_pdf_url = str(public_url)

        db.add(ProtestAttachment(
            protest_id=p.id,
            kind="decision_pdf",
            filename=os.path.basename(str(public_url)),
            content_type="application/pdf",
            size=(file_path.stat().st_size if file_path else 0),
            url=p.decision_pdf_url,
            uploaded_by_user_id=current_user.id,
        ))
        db.add(p)
        db.commit()
    except Exception as err:
        db.rollback()
        print(f"[PROTEST_DECISION_PDF][protest={p.id}] falhou: {err}")

    return {"ok": True, "decision_pdf_url": p.decision_pdf_url}
