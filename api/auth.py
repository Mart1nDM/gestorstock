from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, EmailStr

try:
    from .db import db
    from .deps import current_user
    from .mailer import notify_admin_new_request
    from .spam_protection import require_turnstile
except ImportError:
    from db import db
    from deps import current_user
    from mailer import notify_admin_new_request
    from spam_protection import require_turnstile

router = APIRouter(prefix="/api/auth", tags=["auth"])


class ContactIn(BaseModel):
    nombre: str
    correo: EmailStr
    telefono: str | None = None
    plan: str | None = None
    mensaje: str
    cf_turnstile_response: str | None = None


@router.get("/me")
def me(user=Depends(current_user)):
    return user.profile | {"id": user.id, "correo": user.email}


@router.post("/contact")
def contact(payload: ContactIn, request: Request):
    require_turnstile(payload.cf_turnstile_response, request.client.host if request.client else None)
    data = payload.model_dump(exclude={"cf_turnstile_response"})
    result = db().table("contact_requests").insert(data).execute()
    notify_admin_new_request(
        nombre=data["nombre"],
        correo=data["correo"],
        telefono=data.get("telefono"),
        plan=data.get("plan"),
        mensaje=data["mensaje"],
    )
    return {"ok": True, "id": result.data[0]["id"]}


@router.get("/invitations/{token}")
def get_invitation(token: str):
    invitation = (
        db()
        .table("account_invitations")
        .select("profile_id, nombre, correo, plan, estado")
        .eq("profile_id", token)
        .eq("estado", "pendiente")
        .limit(1)
        .execute()
        .data
        or []
    )
    if not invitation:
        raise HTTPException(404, "La invitación no es válida o ya fue usada.")
    row = invitation[0]
    return {
        "ok": True,
        "profile_id": row["profile_id"],
        "nombre": row["nombre"],
        "correo": row["correo"],
        "plan": row.get("plan"),
    }


@router.post("/invitations/complete")
def complete_invitation(token: str, user=Depends(current_user)):
    if not token or token.strip() != user.id:
        raise HTTPException(401, "Ese enlace de invitación no corresponde a tu cuenta.")
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
