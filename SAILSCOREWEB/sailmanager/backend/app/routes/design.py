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
                    listing_logo_url=getattr(r, "listing_logo_url", None),
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
    club_logo_url: str | None = None
    club_logo_link: str | None = None


class HeaderOut(BaseModel):
    club_logo_url: str | None = None
    club_logo_link: str | None = None


class HomepageUpdate(BaseModel):
    home_images: list[dict] | None = None  # [{url, position_x?, position_y?}, ...] max 3
    hero_title: str | None = None
    hero_subtitle: str | None = None
    club_logo_url: str | None = None
    club_logo_link: str | None = None


class FooterDesignOut(BaseModel):
    footer_site_name: str | None = None
    footer_tagline: str | None = None
    footer_contact_email: str | None = None
    footer_phone: str | None = None
    footer_address: str | None = None
    footer_instagram_url: str | None = None
    footer_facebook_url: str | None = None
    footer_show_privacy_policy: bool = True
    footer_show_terms_of_service: bool = True
    footer_show_cookie_policy: bool = True
    footer_privacy_policy_text: str | None = None
    footer_terms_of_service_text: str | None = None
    footer_cookie_policy_text: str | None = None


class FooterDesignUpdate(BaseModel):
    footer_site_name: str | None = None
    footer_tagline: str | None = None
    footer_contact_email: str | None = None
    footer_phone: str | None = None
    footer_address: str | None = None
    footer_instagram_url: str | None = None
    footer_facebook_url: str | None = None
    footer_show_privacy_policy: bool | None = None
    footer_show_terms_of_service: bool | None = None
    footer_show_cookie_policy: bool | None = None
    footer_privacy_policy_text: str | None = None
    footer_terms_of_service_text: str | None = None
    footer_cookie_policy_text: str | None = None


@router.get("/homepage", response_model=HomepageOut)
def get_homepage_design(db: Session = Depends(get_db)):
    """Public: returns homepage hero images, hero text and header settings."""
    row = db.query(models.SiteDesign).filter(models.SiteDesign.id == CONFIG_ID).first()
    if not row:
        return HomepageOut(home_images=[], hero_title=None, hero_subtitle=None, club_logo_url=None, club_logo_link=None)
    images = (row.home_images or [])[:3]
    return HomepageOut(
        home_images=images,
        hero_title=getattr(row, "hero_title", None),
        hero_subtitle=getattr(row, "hero_subtitle", None),
        club_logo_url=getattr(row, "club_logo_url", None),
        club_logo_link=getattr(row, "club_logo_link", None),
    )


@router.get("/header", response_model=HeaderOut)
def get_header_design(db: Session = Depends(get_db)):
    """Public: returns header club logo and link for the main site."""
    row = db.query(models.SiteDesign).filter(models.SiteDesign.id == CONFIG_ID).first()
    if not row:
        return HeaderOut(club_logo_url=None, club_logo_link=None)
    return HeaderOut(
        club_logo_url=getattr(row, "club_logo_url", None),
        club_logo_link=getattr(row, "club_logo_link", None),
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
    if body.club_logo_url is not None:
        row.club_logo_url = body.club_logo_url.strip() or None
    if body.club_logo_link is not None:
        row.club_logo_link = body.club_logo_link.strip() or None
    db.commit()
    db.refresh(row)
    return HomepageOut(
        home_images=row.home_images or [],
        hero_title=getattr(row, "hero_title", None),
        hero_subtitle=getattr(row, "hero_subtitle", None),
        club_logo_url=getattr(row, "club_logo_url", None),
        club_logo_link=getattr(row, "club_logo_link", None),
    )


@router.get("/footer", response_model=FooterDesignOut)
def get_footer_design(db: Session = Depends(get_db)):
    """Public: returns footer configuration (brand, contacts, legal texts)."""
    row = db.query(models.SiteDesign).filter(models.SiteDesign.id == CONFIG_ID).first()
    if not row:
        # Defaults if not configured yet
        return FooterDesignOut()
    return FooterDesignOut(
        footer_site_name=getattr(row, "footer_site_name", None),
        footer_tagline=getattr(row, "footer_tagline", None),
        footer_contact_email=getattr(row, "footer_contact_email", None),
        footer_phone=getattr(row, "footer_phone", None),
        footer_address=getattr(row, "footer_address", None),
        footer_instagram_url=getattr(row, "footer_instagram_url", None),
        footer_facebook_url=getattr(row, "footer_facebook_url", None),
        footer_show_privacy_policy=bool(
            getattr(row, "footer_show_privacy_policy", True)
        ),
        footer_show_terms_of_service=bool(
            getattr(row, "footer_show_terms_of_service", True)
        ),
        footer_show_cookie_policy=bool(
            getattr(row, "footer_show_cookie_policy", True)
        ),
        footer_privacy_policy_text=getattr(row, "footer_privacy_policy_text", None),
        footer_terms_of_service_text=getattr(row, "footer_terms_of_service_text", None),
        footer_cookie_policy_text=getattr(row, "footer_cookie_policy_text", None),
    )


@router.put("/footer", response_model=FooterDesignOut)
def set_footer_design(
    body: FooterDesignUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")
    row = _get_or_create_site_design(db)

    def _clean(value: str | None) -> str | None:
        if value is None:
            return None
        v = value.strip()
        return v or None

    if body.footer_site_name is not None:
        row.footer_site_name = _clean(body.footer_site_name)
    if body.footer_tagline is not None:
        row.footer_tagline = _clean(body.footer_tagline)
    if body.footer_contact_email is not None:
        row.footer_contact_email = _clean(body.footer_contact_email)
    if body.footer_phone is not None:
        row.footer_phone = _clean(body.footer_phone)
    if body.footer_address is not None:
        row.footer_address = _clean(body.footer_address)
    if body.footer_instagram_url is not None:
        row.footer_instagram_url = _clean(body.footer_instagram_url)
    if body.footer_facebook_url is not None:
        row.footer_facebook_url = _clean(body.footer_facebook_url)
    if body.footer_show_privacy_policy is not None:
        row.footer_show_privacy_policy = bool(body.footer_show_privacy_policy)
    if body.footer_show_terms_of_service is not None:
        row.footer_show_terms_of_service = bool(body.footer_show_terms_of_service)
    if body.footer_show_cookie_policy is not None:
        row.footer_show_cookie_policy = bool(body.footer_show_cookie_policy)
    if body.footer_privacy_policy_text is not None:
        row.footer_privacy_policy_text = _clean(body.footer_privacy_policy_text)
    if body.footer_terms_of_service_text is not None:
        row.footer_terms_of_service_text = _clean(body.footer_terms_of_service_text)
    if body.footer_cookie_policy_text is not None:
        row.footer_cookie_policy_text = _clean(body.footer_cookie_policy_text)

    db.commit()
    db.refresh(row)
    return get_footer_design(db)
