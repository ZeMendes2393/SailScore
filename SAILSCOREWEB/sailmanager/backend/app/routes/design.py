# app/routes/design.py — featured regattas for homepage (when no upcoming)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel

from app import models, schemas
from app.database import get_db
from utils.auth_utils import get_current_user

router = APIRouter(prefix="/design", tags=["design"])

CONFIG_ID = 1


def _get_or_create_site_design(db: Session) -> models.SiteDesign:
    row = db.query(models.SiteDesign).filter(models.SiteDesign.id == CONFIG_ID).first()
    if not row:
        row = models.SiteDesign(id=CONFIG_ID, featured_regatta_ids=[])
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.get("/featured-regattas", response_model=list[schemas.RegattaListRead])
def get_featured_regattas(db: Session = Depends(get_db)):
    """Public: returns up to 3 regattas to show on homepage when there are no upcoming ones."""
    row = db.query(models.SiteDesign).filter(models.SiteDesign.id == CONFIG_ID).first()
    ids = (row.featured_regatta_ids or [])[:3] if row else []
    if not ids:
        return []
    regattas = (
        db.query(models.Regatta)
        .options(joinedload(models.Regatta.classes))
        .filter(models.Regatta.id.in_(ids))
        .all()
    )
    # Preserve order of ids
    by_id = {r.id: r for r in regattas}
    result = []
    for i in ids:
        if i in by_id:
            r = by_id[i]
            result.append(
                schemas.RegattaListRead(
                    id=r.id,
                    name=r.name,
                    location=r.location,
                    start_date=r.start_date,
                    end_date=r.end_date,
                    online_entry_open=r.online_entry_open if r.online_entry_open is not None else True,
                    class_names=[c.class_name for c in sorted(r.classes or [], key=lambda c: (c.class_name or ""))],
                )
            )
    return result


class FeaturedRegattasUpdate(BaseModel):
    regatta_ids: list[int]


@router.put("/featured-regattas")
def set_featured_regattas(
    body: FeaturedRegattasUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    ids = body.regatta_ids[:3]
    row = _get_or_create_site_design(db)
    row.featured_regatta_ids = ids
    db.commit()
    return {"regatta_ids": ids}


@router.get("/featured-regattas/ids")
def get_featured_regatta_ids(db: Session = Depends(get_db)):
    """Public: returns list of up to 3 regatta IDs (for admin UI to show current selection)."""
    row = db.query(models.SiteDesign).filter(models.SiteDesign.id == CONFIG_ID).first()
    if not row or not row.featured_regatta_ids:
        return []
    return (row.featured_regatta_ids or [])[:3]


# ---------- Homepage hero images (same as regatta home_images) ----------

class HomepageOut(BaseModel):
    home_images: list[dict]
    hero_title: str | None = None
    hero_subtitle: str | None = None


class HomepageUpdate(BaseModel):
    home_images: list[dict] | None = None  # [{url, position_x?, position_y?}, ...] max 3
    hero_title: str | None = None
    hero_subtitle: str | None = None


@router.get("/homepage", response_model=HomepageOut)
def get_homepage_design(db: Session = Depends(get_db)):
    """Public: returns homepage hero images and hero text for the main site."""
    row = db.query(models.SiteDesign).filter(models.SiteDesign.id == CONFIG_ID).first()
    if not row:
        return HomepageOut(home_images=[], hero_title=None, hero_subtitle=None)
    images = (row.home_images or [])[:3]
    return HomepageOut(
        home_images=images,
        hero_title=getattr(row, "hero_title", None),
        hero_subtitle=getattr(row, "hero_subtitle", None),
    )


@router.put("/homepage", response_model=HomepageOut)
def set_homepage_design(
    body: HomepageUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    row = _get_or_create_site_design(db)
    if body.home_images is not None:
        row.home_images = body.home_images[:3]
    if body.hero_title is not None:
        row.hero_title = body.hero_title.strip() or None
    if body.hero_subtitle is not None:
        row.hero_subtitle = body.hero_subtitle.strip() or None
    db.commit()
    db.refresh(row)
    return HomepageOut(
        home_images=row.home_images or [],
        hero_title=getattr(row, "hero_title", None),
        hero_subtitle=getattr(row, "hero_subtitle", None),
    )
