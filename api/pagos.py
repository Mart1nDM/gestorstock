import os
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from httpx import Client as HttpxClient
from pydantic import BaseModel, EmailStr

try:
    from .db import db
    from .deps import SITE_URL, load_env_file
except ImportError:
    from db import db
    from deps import SITE_URL, load_env_file

load_env_file()

router = APIRouter(prefix="/api/pagos", tags=["pagos"])

MERCADOPAGO_ACCESS_TOKEN = os.environ.get("MERCADOPAGO_ACCESS_TOKEN", "").strip()
_MERCADOPAGO_API = "https://api.mercadopago.com"

PLAN_PRICES = {
    "premium": {"nombre": "Premium", "precio": 5.99},
    "pro": {"nombre": "Pro", "precio": 10.99},
}

_FRONTEND_URL = (SITE_URL or "https://gestorstock-web.vercel.app").rstrip("/")


def _client() -> HttpxClient:
    if not MERCADOPAGO_ACCESS_TOKEN:
        raise HTTPException(500, "MercadoPago no está configurado en el backend.")
    return HttpxClient(
        base_url=_MERCADOPAGO_API,
        headers={"Authorization": f"Bearer {MERCADOPAGO_ACCESS_TOKEN}"},
        timeout=30.0,
    )


class PreferenciaIn(BaseModel):
    nombre: str
    apellido: str = ""
    correo: EmailStr
    telefono: str | None = None
    plan_key: str


@router.post("/preferencia")
def crear_preferencia(payload: PreferenciaIn):
    plan = PLAN_PRICES.get(payload.plan_key)
    if not plan:
        raise HTTPException(400, "Seleccioná un plan válido (Premium o Pro).")
    if not payload.correo:
        raise HTTPException(400, "El correo es obligatorio.")

    preferencia_id = str(uuid4())
    reference = f"gestor-{payload.plan_key}-{preferencia_id}"

    preference = {
        "items": [
            {
                "title": f"Licencia plan {plan['nombre']} - Gestor Online",
                "quantity": 1,
                "unit_price": float(plan["precio"]),
                "currency_id": "ARS",
            }
        ],
        "payer": {
            "name": payload.nombre,
            "surname": payload.apellido,
            "email": payload.correo,
            "phone": {"number": payload.telefono or ""},
        },
        "external_reference": reference,
        "back_urls": {
            "success": f"{_FRONTEND_URL}/pago-confirmado?plan={payload.plan_key}&email={payload.correo}&status=approved",
            "pending": f"{_FRONTEND_URL}/pago-confirmado?plan={payload.plan_key}&email={payload.correo}&status=pending",
            "failure": f"{_FRONTEND_URL}/pago-confirmado?plan={payload.plan_key}&email={payload.correo}&status=failure",
        },
        "auto_return": "approved",
    }

    with _client() as client:
        response = client.post("/checkout/preferences", json=preference)
        if response.status_code not in (200, 201):
            raise HTTPException(502, f"MercadoPago no pudo crear la preferencia (HTTP {response.status_code}).")
        result = response.json()
    mp_preference_id = result.get("id")
    init_point = result.get("init_point") or result.get("sandbox_init_point")

    if not init_point:
        raise HTTPException(502, "MercadoPago no devolvió una URL de pago.")

    db().table("pagos").insert(
        {
            "preferencia_id": preferencia_id,
            "correo": payload.correo.strip().lower(),
            "nombre": payload.nombre,
            "apellido": payload.apellido,
            "telefono": payload.telefono,
            "plan_key": payload.plan_key,
            "monto": float(plan["precio"]),
            "estado": "pending",
        }
    ).execute()

    return {"ok": True, "init_point": init_point, "preferencia_id": preferencia_id, "mercadopago_preference_id": mp_preference_id}


def _normalizar_correo(correo: str) -> str:
    return (correo or "").strip().lower()


def _crear_cuenta_pagada(correo: str, plan_key: str, telefono: str | None):
    from .usuarios import _ensure_plan_id

    plan_nombre = PLAN_PRICES[plan_key]["nombre"]
    plan_id = _ensure_plan_id(plan_nombre)

    local_part = correo.split("@", 1)[0] or "Usuario"
    created = db().auth.admin.create_user(
        {
            "email": correo,
            "email_confirm": True,
            "user_metadata": {"nombre": local_part, "apellido": "", "plan": plan_nombre},
            "data": {"nombre": local_part, "apellido": "", "plan": plan_nombre},
        }
    )
    user_id = str(getattr(created, "user", None).id)

    db().table("profiles").upsert(
        {
            "id": user_id,
            "nombre": local_part,
            "apellido": "",
            "correo": correo,
            "telefono": telefono,
            "rol": "cliente",
            "plan_id": plan_id,
            "activo": True,
        }
    ).execute()
    return user_id


def _procesar_pago_aprobado(mp_payment_id):
    with _client() as client:
        response = client.get(f"/v1/payments/{mp_payment_id}")
        if response.status_code != 200:
            return False
        data = response.json()
    if not data:
        return False

    status = data.get("status")
    reference = data.get("external_reference") or ""
    plan_key = None
    if "premium" in reference:
        plan_key = "premium"
    elif "pro" in reference:
        plan_key = "pro"
    if not plan_key:
        return False

    correo = _normalizar_correo(data.get("payer", {}).get("email") or "")
    row = (
        db()
        .table("pagos")
        .select("id, telefono, correo")
        .eq("preferencia_id", reference.replace(f"gestor-{plan_key}-", ""))
        .limit(1)
        .execute()
        .data
        or []
    )
    if not row:
        query = (
            db()
            .table("pagos")
            .select("id, telefono, correo")
            .eq("plan_key", plan_key)
            .eq("wallet_processed", False)
        )
        if correo:
            query = query.eq("correo", correo)
        row = query.order("created_at", desc=True).limit(1).execute().data or []
    if not row:
        return False

    row = row[0]
    if not correo:
        correo = row.get("correo")

    if status == "approved":
        existing = db().table("pagos").select("profile_id").eq("id", row["id"]).limit(1).execute().data or []
        if existing and existing[0].get("profile_id"):
            db().table("pagos").update({"estado": "approved", "mercadopago_id": int(mp_payment_id), "wallet_processed": True}).eq("id", row["id"]).execute()
            return True
        profile_id = _crear_cuenta_pagada(correo, plan_key, row.get("telefono"))
        now = datetime.now(timezone.utc).isoformat()
        db().table("pagos").update(
            {
                "estado": "approved",
                "mercadopago_id": int(mp_payment_id),
                "profile_id": profile_id,
                "wallet_processed": True,
                "updated_at": now,
            }
        ).eq("id", row["id"]).execute()
        return True

    if status in ("rejected", "cancelled"):
        now = datetime.now(timezone.utc).isoformat()
        db().table("pagos").update({"estado": status, "updated_at": now}).eq("id", row["id"]).execute()
    return False


@router.post("/webhook")
async def webhook(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}

    action = str(body.get("action") or body.get("type") or "")
    data_obj = body.get("data") or {}
    mp_id = data_obj.get("id") or body.get("data_id")

    if action.startswith("payment") and mp_id:
        _procesar_pago_aprobado(mp_id)
    return {"ok": True}


class SetPasswordIn(BaseModel):
    correo: EmailStr
    password: str
    plan_key: str


@router.post("/set-password")
def set_password(payload: SetPasswordIn):
    correo = _normalizar_correo(payload.correo)
    if len(payload.password) < 6:
        raise HTTPException(400, "La contraseña debe tener al menos 6 caracteres.")

    row = (
        db()
        .table("pagos")
        .select("*")
        .eq("correo", correo)
        .eq("plan_key", payload.plan_key)
        .eq("estado", "approved")
        .eq("wallet_processed", True)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not row:
        raise HTTPException(403, "No encontramos un pago aprobado para ese correo. Por favor, verifica tu compra.")

    user_id = row[0].get("profile_id")
    if not user_id:
        raise HTTPException(400, "La cuenta aún no fue creada. Probá en unos segundos.")

    try:
        db().auth.admin.update_user_by_id(user_id, {"password": payload.password})
    except Exception as exc:
        raise HTTPException(400, "No se pudo establecer la contraseña.") from exc

    return {"ok": True}
