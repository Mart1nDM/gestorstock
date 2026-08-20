from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr

try:
    from .db import db
    from .deps import current_user
except ImportError:
    from db import db
    from deps import current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


class ContactIn(BaseModel):
    nombre: str
    correo: EmailStr
    telefono: str | None = None
    plan: str | None = None
    mensaje: str


@router.get("/me")
def me(user=Depends(current_user)):
    return user.profile | {"id": user.id, "correo": user.email}


@router.post("/contact")
def contact(payload: ContactIn):
    data = payload.model_dump()
    result = db().table("contact_requests").insert(data).execute()
    return {"ok": True, "id": result.data[0]["id"]}


@router.post("/invitations/complete")
def complete_invitation(user=Depends(current_user)):
    invitation = (
        db()
        .table("account_invitations")
        .select("*")
        .eq("profile_id", user.id)
        .eq("estado", "pendiente")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not invitation:
        return {"ok": True, "updated": False}

    row = invitation[0]
    now = datetime.now(timezone.utc).isoformat()
    db().table("account_invitations").update({"estado": "completada", "consumed_at": now}).eq("id", row["id"]).execute()
    if row.get("request_id"):
        db().table("contact_requests").update({"estado": "cerrado"}).eq("id", row["request_id"]).execute()
    return {"ok": True, "updated": True}
