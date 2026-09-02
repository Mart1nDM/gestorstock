from datetime import datetime, timezone
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

try:
    from .db import db
    from .deps import SITE_URL, current_user, require_superadmin
    from .mailer import notify_admin_invitation_sent, send_invitation_email
except ImportError:
    from db import db
    from deps import SITE_URL, current_user, require_superadmin
    from mailer import notify_admin_invitation_sent, send_invitation_email

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


def _invite_redirect_url(token: str) -> str:
    site_url = (SITE_URL or "").strip().rstrip("/")
    if not site_url or "localhost" in site_url or "127.0.0.1" in site_url:
        site_url = "https://gestorstock-web.vercel.app"
    return f"{site_url}/set-password?token={token}"


def _force_invite_redirect(action_link: str, token: str) -> str:
    parsed = urlparse(action_link)
    params = dict(parse_qsl(parsed.query, keep_blank_values=True))
    params["redirect_to"] = _invite_redirect_url(token)
    return urlunparse(parsed._replace(query=urlencode(params, doseq=True)))


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
    existing_invitation = None
    if request_id is not None:
        try:
            existing_invitation = db().table("account_invitations").select("*").eq("request_id", request_id).limit(1).execute().data or []
        except Exception as exc:
            if _is_missing_account_invitations_table(exc):
                raise HTTPException(500, "Falta crear la tabla account_invitations en Supabase.") from exc
            raise
        existing_invitation = existing_invitation[0] if existing_invitation else None

    plan_id = _ensure_plan_id(plan)
    auth_user = _find_auth_user_by_email(correo)
    existing_auth_user = auth_user is not None
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
            "type": "recovery" if existing_auth_user else "invite",
            "email": correo,
            "options": {
                "data": {"nombre": nombre, "apellido": apellido},
                "redirect_to": _invite_redirect_url(),
            },
        }
    )

    invite_url = _force_invite_redirect(link.properties.action_link, str(auth_user.id))
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
        if existing_invitation:
            inserted = db().table("account_invitations").update(invitation_payload).eq("id", existing_invitation["id"]).execute().data[0]
        else:
            inserted = db().table("account_invitations").insert(invitation_payload).execute().data[0]
    except Exception as exc:
        if _is_missing_account_invitations_table(exc):
            raise HTTPException(500, "Falta crear la tabla account_invitations en Supabase.") from exc
        raise

    if request_id is not None:
        db().table("contact_requests").update({"estado": "contactado"}).eq("id", request_id).execute()

    send_invitation_email(correo=correo, nombre=nombre, invite_url=invite_url)
    notify_admin_invitation_sent(correo=correo, nombre=nombre)

    return inserted


@router.get("")
def list_users(q: str = "", user=Depends(current_user)):
    require_superadmin(user)
    users = db().table("profiles").select("*, plans(id,nombre)").order("created_at", desc=True).execute().data or []
    solicitudes = db().table("contact_requests").select("*").eq("estado", "nuevo").order("creado_en", desc=True).execute().data or []
    cuentas = _list_account_invitations()
    pending_profiles = {str(i.get("profile_id")) for i in cuentas if i.get("estado") == "pendiente"}

    if q.strip():
        term = q.lower()
        users = [r for r in users if term in " ".join(str(r.get(k) or "") for k in ["nombre", "apellido", "correo", "rol", "activo"]).lower() or term in str((r.get("plans") or {}).get("nombre") or "").lower()]
        solicitudes = [r for r in solicitudes if term in " ".join(str(r.get(k) or "") for k in ["nombre", "correo", "telefono", "plan", "mensaje", "estado"]).lower()]
        cuentas = [r for r in cuentas if term in " ".join(str(r.get(k) or "") for k in ["nombre", "correo", "telefono", "plan", "estado"]).lower()]

    for r in users:
        plan = r.pop("plans", None) or {}
        r["plan_id"] = plan.get("id")
        r["plan_nombre"] = plan.get("nombre")
        r["invite_pendiente"] = r["id"] in pending_profiles

    planes = db().table("plans").select("id,nombre").eq("activo", True).order("nombre").execute().data or []
    return {"usuarios": users, "solicitudes": solicitudes, "cuentas": cuentas, "planes": planes}


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
@router.post("/solicitudes/{request_id}/contactar")
def contact_request(request_id: int, user=Depends(current_user)):
    require_superadmin(user)
    request_row = db().table("contact_requests").select("*").eq("id", request_id).single().execute().data
    if not request_row:
        raise HTTPException(404, "Solicitud no encontrada.")
    if request_row.get("estado") != "nuevo":
        return {"ok": True, "updated": False}

    db().table("contact_requests").update({"estado": "contactado"}).eq("id", request_id).execute()
    return {"ok": True, "updated": True}


@router.delete("/solicitudes/{request_id}")
def delete_request(request_id: int, user=Depends(current_user)):
    require_superadmin(user)
    request_row = db().table("contact_requests").select("id").eq("id", request_id).limit(1).execute().data or []
    if not request_row:
        raise HTTPException(404, "Solicitud no encontrada.")
    db().table("contact_requests").delete().eq("id", request_id).execute()
    return {"ok": True, "deleted": True}


class TemporaryPasswordIn(BaseModel):
    password: str


@router.post("/{user_id}/temporary-password")
def set_temporary_password(user_id: str, payload: TemporaryPasswordIn, user=Depends(current_user)):
    require_superadmin(user)
    if len(payload.password) < 6:
        raise HTTPException(400, "La contraseña temporal debe tener al menos 6 caracteres.")
    if user_id == user.id:
        raise HTTPException(400, "Usá la opción de perfil para cambiar tu propia contraseña.")
    try:
        updated = db().auth.admin.update_user_by_id(user_id, {"password": payload.password})
        if not getattr(updated, "user", None):
            raise HTTPException(404, "Usuario no encontrado.")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, "No se pudo establecer la contraseña temporal.") from exc
    now = datetime.now(timezone.utc).isoformat()
    db().table("account_invitations").update({"estado": "completada", "consumed_at": now}).eq("profile_id", user_id).eq("estado", "pendiente").execute()
    return {"ok": True}


class PlanUpdateIn(BaseModel):
    plan: str


@router.put("/{user_id}/plan")
def update_user_plan(user_id: str, payload: PlanUpdateIn, user=Depends(current_user)):
    require_superadmin(user)
    plan_name = payload.plan.strip()
    if plan_name not in {"Gratis", "Premium", "Pro"}:
        raise HTTPException(400, "Seleccioná un plan.")
    plan_id = _ensure_plan_id(plan_name)
    result = db().table("profiles").update({"plan_id": plan_id}).eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(404, "Usuario no encontrado.")
    return {"ok": True, "plan_id": plan_id, "plan_nombre": plan_name}


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

