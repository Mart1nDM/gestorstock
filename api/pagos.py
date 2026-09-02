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

try:
    from .usuarios import _find_auth_user_by_email, _ensure_plan_id
except ImportError:
    from usuarios import _find_auth_user_by_email, _ensure_plan_id

load_env_file()

router = APIRouter(prefix="/api/pagos", tags=["pagos"])

MERCADOPAGO_ACCESS_TOKEN = os.environ.get("MERCADOPAGO_ACCESS_TOKEN", "").strip()
_MERCADOPAGO_API = "https://api.mercadopago.com"

PLAN_PRICES = {
    "premium": {"nombre": "Premium", "precio": 5099.99},
    "pro": {"nombre": "Pro", "precio": 9999.99},
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


def _buscar_auth_user_por_email(correo: str) -> str | None:
    auth_user = _find_auth_user_by_email(correo)
    if auth_user:
        return str(auth_user.id)
    return None


def _crear_cuenta_pagada(correo: str, plan_key: str, telefono: str | None):
    plan_nombre = PLAN_PRICES[plan_key]["nombre"]
    plan_id = _ensure_plan_id(plan_nombre)

    local_part = correo.split("@", 1)[0] or "Usuario"

    user_id = _buscar_auth_user_por_email(correo)
    if user_id:
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


def _consultar_pago(mp_payment_id) -> dict | None:
    with _client() as client:
        response = client.get(f"/v1/payments/{mp_payment_id}")
        if response.status_code != 200:
            return None
        return response.json()


def _encontrar_fila(plan_key: str, correo: str | None, preferencia_id: str | None) -> dict | None:
    if preferencia_id:
        row = (
            db()
            .table("pagos")
            .select("id, telefono, correo")
            .eq("preferencia_id", preferencia_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        if row:
            return row[0]
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
    return row[0] if row else None


def _marcar_estado(pago_row_id: int, estado: str, mp_payment_id: int | None = None):
    payload = {"estado": estado, "updated_at": datetime.now(timezone.utc).isoformat()}
    if mp_payment_id:
        payload["mercadopago_id"] = mp_payment_id
    db().table("pagos").update(payload).eq("id", pago_row_id).execute()


def _procesar_pago(mp_payment_id, *, plan_key_hint: str | None = None) -> bool:
    data = _consultar_pago(mp_payment_id)
    print(f"[procesar_pago] pid={mp_payment_id} consultar={bool(data)}")
    if not data:
        return False

    status = data.get("status")
    reference = data.get("external_reference") or ""

    plan_key = plan_key_hint
    if not plan_key:
        if "premium" in reference:
            plan_key = "premium"
        elif "pro" in reference:
            plan_key = "pro"
    print(f"[procesar_pago] status={status} plan_key={plan_key} ref={reference}")
    if not plan_key:
        return False

    preferencia_id = None
    if reference:
        marker = f"gestor-{plan_key}-"
        if marker in reference:
            preferencia_id = reference.replace(marker, "")

    row = _encontrar_fila(plan_key, None, preferencia_id)
    if not row:
        payer_correo = _normalizar_correo(data.get("payer", {}).get("email") or "")
        row = _encontrar_fila(plan_key, payer_correo or None, None)
    print(f"[procesar_pago] fila={bool(row)} preferencia_id={preferencia_id}")
    if not row:
        return False

    correo = _normalizar_correo(row.get("correo") or "")
    print(f"[procesar_pago] correo={correo}")
    if not correo:
        return False

    if status == "approved":
        existing = db().table("pagos").select("profile_id").eq("id", row["id"]).limit(1).execute().data or []
        if existing and existing[0].get("profile_id"):
            print(f"[procesar_pago] ya-procesada profile_id={existing[0].get('profile_id')}")
            _marcar_estado(row["id"], "approved", int(mp_payment_id))
            return True
        try:
            print(f"[procesar_pago] creando cuenta para {correo} ({plan_key})")
            profile_id = _crear_cuenta_pagada(correo, plan_key, row.get("telefono"))
            print(f"[procesar_pago] cuenta creada profile_id={profile_id}")
        except Exception as exc:
            print(f"[procesar_pago] ERROR al crear cuenta: {type(exc).__name__}: {exc}")
            import traceback
            traceback.print_exc()
            return False
        db().table("pagos").update(
            {
                "estado": "approved",
                "mercadopago_id": int(mp_payment_id),
                "profile_id": profile_id,
                "wallet_processed": True,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
        ).eq("id", row["id"]).execute()
        return True

    if status in ("rejected", "cancelled"):
        _marcar_estado(row["id"], status, int(mp_payment_id))

    return False


@router.post("/webhook")
async def webhook(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}

    action = str(body.get("action") or body.get("type") or "")
    data_obj = body.get("data") or {}
    mp_id = data_obj.get("id") or body.get("data_id") or request.query_params.get("id")
    if mp_id and ("payment" in action or request.query_params.get("topic") == "payment"):
        _procesar_pago(mp_id)
    return {"ok": True}


def _procesar_por_correo(correo: str, plan_key: str) -> bool:
    if not correo:
        return False
    rows = (
        db()
        .table("pagos")
        .select("preferencia_id")
        .eq("correo", correo)
        .eq("plan_key", plan_key)
        .limit(50)
        .execute()
        .data
        or []
    )
    if not rows:
        return False
    any_ok = False
    for r in rows:
        preferencia_id = r.get("preferencia_id")
        if not preferencia_id:
            continue
        reference = f"gestor-{plan_key}-{preferencia_id}"
        payment_ids: set = set()
        try:
            with _client() as client:
                search = client.get("/v1/payments/search", params={"external_reference": reference, "limit": 50})
                if search.status_code == 200:
                    results = (search.json() or {}).get("results") or []
                    for p in results:
                        pid = p.get("id")
                        if pid:
                            payment_ids.add(int(pid))
        except Exception:
            continue
        for mp_id in payment_ids:
            try:
                if _procesar_pago(mp_id, plan_key_hint=plan_key):
                    any_ok = True
            except Exception:
                continue
    return any_ok


def _buscar_aprobacion(correo: str, plan_key: str) -> list:
    return (
        db()
        .table("pagos")
        .select("*")
        .eq("correo", correo)
        .eq("plan_key", plan_key)
        .eq("estado", "approved")
        .eq("wallet_processed", True)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )


def _reconciliar_pago(correo: str, plan_key: str, payment_id: int | None) -> bool:
    """Intenta confirmar el pago con todas las estrategias disponibles y marca la fila como aprobada.

    Da prioridad al payment_id de la URL, pero si no está presente o no resuelve,
    procesa por correo (buscando en MercadoPago las preferencias de ese cliente)."""
    if payment_id:
        try:
            if _procesar_pago(payment_id, plan_key_hint=plan_key):
                return True
        except Exception:
            pass
    try:
        if _procesar_por_correo(correo, plan_key):
            return True
    except Exception:
        pass
    return _buscar_aprobacion(correo, plan_key) and True


class VerifyIn(BaseModel):
    correo: EmailStr
    plan_key: str
    payment_id: int | None = None


@router.post("/verificar")
def verificar_pago(payload: VerifyIn):
    correo = _normalizar_correo(payload.correo)
    _reconciliar_pago(correo, payload.plan_key, payload.payment_id)

    row = _buscar_aprobacion(correo, payload.plan_key)
    if not row:
        return {"ok": False, "approved": False}
    return {"ok": True, "approved": True}


class SetPasswordIn(BaseModel):
    correo: EmailStr
    password: str
    plan_key: str
    payment_id: int | None = None


@router.post("/set-password")
def set_password(payload: SetPasswordIn):
    correo = _normalizar_correo(payload.correo)
    if len(payload.password) < 6:
        raise HTTPException(400, "La contraseña debe tener al menos 6 caracteres.")

    _reconciliar_pago(correo, payload.plan_key, payload.payment_id)

    row = _buscar_aprobacion(correo, payload.plan_key)
    if not row:
        raise HTTPException(403, "No encontramos un pago aprobado para ese correo. Si ya pagaste, esperá unos segundos y volvé a intentar, o revisá que hayas usado el mismo correo.")

    user_id = row[0].get("profile_id")
    if not user_id:
        raise HTTPException(400, "La cuenta aún no fue creada. Esperá unos segundos y volvé a intentar.")

    try:
        db().auth.admin.update_user_by_id(user_id, {"password": payload.password})
    except Exception as exc:
        raise HTTPException(400, "No se pudo establecer la contraseña.") from exc

    return {"ok": True}
