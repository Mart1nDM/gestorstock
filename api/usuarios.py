from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from .db import db
from .deps import SITE_URL, current_user, require_superadmin

router = APIRouter(prefix="/api/usuarios", tags=["usuarios"])


class UserCreate(BaseModel):
    nombre: str
    apellido: str = ""
    correo: EmailStr
    telefono: str | None = None
    plan: str


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _ensure_plan_id(plan_name: str) -> str:
    plan_rows = db().table("plans").select("id").eq("nombre", plan_name).limit(1).execute().data or []
    if plan_rows:
        return plan_rows[0]["id"]
    return db().table("plans").insert({"nombre": plan_name}).execute().data[0]["id"]


def _find_auth_user_by_email(email: str):
    result = db().auth.admin.list_users(page=1, per_page=1000)
    users = getattr(result, "users", result) or []
    for auth_user in users:
        if _normalize_email(getattr(auth_user, "email", "") or "") == _normalize_email(email):
            return auth_user
    return None


def _ensure_profile(user_id: str, payload: dict, plan_id: str) -> dict:
    existing = db().table("profiles").select("id").eq("id", user_id).limit(1).execute().data or []
    row = {
        "id": user_id,
        "nombre": payload.get("nombre", "").strip() or "Usuario",
        "apellido": payload.get("apellido", "").strip(),
        "correo": payload.get("correo", "").strip(),
        "telefono": payload.get("telefono"),
        "rol": "cliente",
        "plan_id": plan_id,
        "activo": True,
    }
    if existing:
        db().table("profiles").update(row).eq("id", user_id).execute()
    else:
        db().table("profiles").insert(row).execute()
    return row


def _is_missing_account_invitations_table(exc: Exception) -> bool:
    text = str(exc).lower()
    return "account_invitations" in text and ("schema cache" in text or "could not find the table" in text)


def _list_account_invitations() -> list[dict]:
    try:
        return db().table("account_invitations").select("*").order("created_at", desc=True).execute().data or []
    except Exception as exc:
        if _is_missing_account_invitations_table(exc):
            return []
        raise


def _generate_invitation(*, nombre: str, apellido: str, correo: str, telefono: str | None, plan: str, request_id: int | None = None) -> dict:
    if request_id is not None:
        try:
            existing_invitation = db().table("account_invitations").select("*").eq("request_id", request_id).limit(1).execute().data or []
        except Exception as exc:
            if _is_missing_account_invitations_table(exc):
                raise HTTPException(500, "Falta crear la tabla account_invitations en Supabase.") from exc
            raise
        if existing_invitation:
            return existing_invitation[0]

    plan_id = _ensure_plan_id(plan)
    auth_user = _find_auth_user_by_email(correo)
    if not auth_user:
        created = db().auth.admin.create_user(
            {
                "email": correo,
                "email_confirm": False,
                "user_metadata": {"nombre": nombre, "apellido": apellido},
                "data": {"nombre": nombre, "apellido": apellido},
            }
        )
        auth_user = created.user

    _ensure_profile(
        str(auth_user.id),
        {
            "nombre": nombre,
            "apellido": apellido,
            "correo": correo,
            "telefono": telefono,
        },
        plan_id,
    )

    link = db().auth.admin.generate_link(
        {
            "type": "invite",
            "email": correo,
            "options": {
                "data": {"nombre": nombre, "apellido": apellido},
                "redirect_to": f"{SITE_URL}/set-password",
            },
        }
    )

    invite_url = link.properties.action_link
    invitation_payload = {
        "request_id": request_id,
        "profile_id": str(auth_user.id),
        "nombre": nombre,
        "correo": correo,
        "telefono": telefono,
        "plan": plan,
        "invite_url": invite_url,
        "estado": "pendiente",
    }
    try:
        inserted = db().table("account_invitations").insert(invitation_payload).execute().data[0]
    except Exception as exc:
        if _is_missing_account_invitations_table(exc):
            raise HTTPException(500, "Falta crear la tabla account_invitations en Supabase.") from exc
        raise

    if request_id is not None:
        db().table("contact_requests").update({"estado": "contactado"}).eq("id", request_id).execute()

    return inserted


@router.get("")
def list_users(q: str = "", user=Depends(current_user)):
    require_superadmin(user)
    users = db().table("profiles").select("*, plans(id,nombre)").order("created_at", desc=True).execute().data or []
    solicitudes = db().table("contact_requests").select("*").eq("estado", "nuevo").order("creado_en", desc=True).execute().data or []
    cuentas = _list_account_invitations()

    if q.strip():
        term = q.lower()
        users = [r for r in users if term in " ".join(str(r.get(k) or "") for k in ["nombre", "apellido", "correo", "rol", "activo"]).lower() or term in str((r.get("plans") or {}).get("nombre") or "").lower()]
        solicitudes = [r for r in solicitudes if term in " ".join(str(r.get(k) or "") for k in ["nombre", "correo", "telefono", "plan", "mensaje", "estado"]).lower()]
        cuentas = [r for r in cuentas if term in " ".join(str(r.get(k) or "") for k in ["nombre", "correo", "telefono", "plan", "estado"]).lower()]

    for r in users:
        plan = r.pop("plans", None) or {}
        r["plan_id"] = plan.get("id")
        r["plan_nombre"] = plan.get("nombre")

    return {"usuarios": users, "solicitudes": solicitudes, "cuentas": cuentas}


@router.post("")
def create_user(payload: UserCreate, user=Depends(current_user)):
    require_superadmin(user)
    try:
        created = _generate_invitation(
            nombre=payload.nombre,
            apellido=payload.apellido,
            correo=payload.correo,
            telefono=payload.telefono,
            plan=payload.plan,
        )
        return {"ok": True, "id": created["profile_id"], "invite_url": created["invite_url"]}
    except Exception as exc:
        raise HTTPException(400, f"No se pudo crear la cuenta: {exc}") from exc


@router.post("/solicitudes/{request_id}/invitar")
def invite_from_request(request_id: int, user=Depends(current_user)):
    require_superadmin(user)
    request_row = db().table("contact_requests").select("*").eq("id", request_id).single().execute().data
    if not request_row:
        raise HTTPException(404, "Solicitud no encontrada.")
    if request_row.get("estado") != "nuevo":
        try:
            existing = db().table("account_invitations").select("*").eq("request_id", request_id).limit(1).execute().data or []
        except Exception as exc:
            if _is_missing_account_invitations_table(exc):
                raise HTTPException(500, "Falta crear la tabla account_invitations en Supabase.") from exc
            raise
        if existing:
            return {"ok": True, "invite_url": existing[0]["invite_url"], "invitation": existing[0]}
        raise HTTPException(400, "La solicitud ya no está pendiente.")

    created = _generate_invitation(
        nombre=request_row["nombre"],
        apellido="",
        correo=request_row["correo"],
        telefono=request_row.get("telefono"),
        plan=request_row.get("plan") or "Plan a definir",
        request_id=request_id,
    )
    return {"ok": True, "invite_url": created["invite_url"], "invitation": created}


@router.post("/{user_id}/toggle")
def toggle_user(user_id: str, user=Depends(current_user)):
    require_superadmin(user)
    if user_id == user.id:
        raise HTTPException(400, "No podés bloquear tu propia cuenta.")
    row = db().table("profiles").select("activo").eq("id", user_id).single().execute().data
    if not row:
        raise HTTPException(404, "Usuario no encontrado.")
    value = not bool(row.get("activo"))
    result = db().table("profiles").update({"activo": value}).eq("id", user_id).execute()
    return result.data[0]
