import os
from dataclasses import dataclass
from pathlib import Path

from fastapi import Header, HTTPException
from httpx import Client as HttpxClient
from supabase import Client, create_client
from supabase.lib.client_options import SyncClientOptions


def load_env_file() -> None:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file()

SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_PUBLISHABLE_KEY = os.environ.get("SUPABASE_PUBLISHABLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "")
SUPABASE_SECRET_KEY = os.environ.get("SUPABASE_SECRET_KEY", "")
SUPERADMIN_EMAIL = os.environ.get("SUPERADMIN_EMAIL", "").strip().lower()
_site_url = (os.environ.get("SITE_URL") or "").strip()
if not _site_url or "localhost" in _site_url or "127.0.0.1" in _site_url:
    _site_url = "https://gestorstock-web.vercel.app"
SITE_URL = _site_url.rstrip("/")


def _client_options() -> SyncClientOptions:
    return SyncClientOptions(httpx_client=HttpxClient(http2=False, timeout=30.0))


public_client: Client | None = create_client(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, options=_client_options()) if SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY else None
admin_client: Client | None = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY, options=_client_options()) if SUPABASE_URL and SUPABASE_SECRET_KEY else None


@dataclass
class AuthUser:
    id: str
    email: str
    profile: dict


def require_env() -> None:
    if public_client is None or admin_client is None:
        raise HTTPException(status_code=500, detail="Faltan variables de entorno de Supabase en el backend.")


def get_bearer(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sesión requerida.")
    return authorization.split(" ", 1)[1]


def is_superadmin_email(email: str) -> bool:
    return bool(SUPERADMIN_EMAIL) and email.strip().lower() == SUPERADMIN_EMAIL


def ensure_plan_id() -> str:
    plan_rows = admin_client.table("plans").select("id").eq("nombre", "Plan a definir").limit(1).execute().data or []
    if plan_rows:
        return plan_rows[0]["id"]
    return admin_client.table("plans").insert({
        "nombre": "Plan a definir",
        "descripcion": "Plan comercial pendiente de definir por el administrador.",
    }).execute().data[0]["id"]


def apply_superadmin_role(profile: dict, email: str) -> dict:
    if is_superadmin_email(email) and profile.get("rol") != "superadmin":
        updated = admin_client.table("profiles").update({"rol": "superadmin"}).eq("id", profile["id"]).execute().data or []
        if updated:
            profile = updated[0]
        else:
            profile["rol"] = "superadmin"
    return profile


def get_or_create_profile(user_id: str, email: str) -> dict:
    rows = admin_client.table("profiles").select("*, plans(nombre)").eq("id", user_id).limit(1).execute().data or []
    if rows:
        row = rows[0]
    else:
        plan_id = ensure_plan_id()
        local_part = email.split("@", 1)[0] if email else "Usuario"
        row = admin_client.table("profiles").insert({
            "id": user_id,
            "nombre": local_part,
            "apellido": "",
            "correo": email,
            "telefono": None,
            "rol": "superadmin" if is_superadmin_email(email) else "cliente",
            "plan_id": plan_id,
            "activo": True,
        }).execute().data[0]
        row["plans"] = {"nombre": "Plan a definir"}

    row = apply_superadmin_role(row, email)

    if not row.get("activo", True):
        raise HTTPException(status_code=403, detail="La cuenta está bloqueada.")

    plan = row.pop("plans", None) or {}
    row["plan_nombre"] = plan.get("nombre")
    return row


def current_user(authorization: str | None = Header(default=None)) -> AuthUser:
    require_env()
    token = get_bearer(authorization)
    try:
        response = public_client.auth.get_user(token)
        user = response.user
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Token inválido o vencido.") from exc

    if not user:
        raise HTTPException(status_code=401, detail="Usuario no autenticado.")

    email = user.email or ""
    try:
        profile = get_or_create_profile(str(user.id), email)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"No se pudo leer o crear el perfil del usuario en Supabase: {exc}") from exc
    return AuthUser(id=str(user.id), email=email or profile.get("correo", ""), profile=profile)


def require_superadmin(user: AuthUser) -> AuthUser:
    if user.profile.get("rol") != "superadmin":
        raise HTTPException(status_code=403, detail="Se requiere rol SuperAdmin.")
    return user
