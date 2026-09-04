from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

try:
    from .deps import SITE_URL, AuthUser, current_user
    from .db import db
except ImportError:
    from deps import SITE_URL, AuthUser, current_user
    from db import db


router = APIRouter(prefix="/api/compartir", tags=["compartir"])

MAX_MIEMBROS = 5
_FRONTEND_URL = (SITE_URL or "https://gestorstock-web.vercel.app").rstrip("/")


def _plan_key(profile: dict) -> str:
    n = str(profile.get("plan_nombre") or "").strip().lower()
    return n if n in ("premium", "pro", "gratis") else "gratis"


def _es_pro(user: AuthUser) -> bool:
    return _plan_key(user.profile) == "pro" or user.profile.get("rol") == "superadmin"


def _normalizar(correo: str) -> str:
    return (correo or "").strip().lower()


@router.get("")
def listar_compartidos(user: AuthUser = Depends(current_user)):
    """Lista a quién comparto mi inventario (soy owner)."""
    rows = (
        db()
        .table("shared_inventories")
        .select("id, miembro_id, token, estado, created_at")
        .eq("owner_id", user.id)
        .order("created_at", desc=True)
        .execute()
        .data
        or []
    )
    # Resolver correo/nombre de cada miembro por separado (evita uniones frágiles por FK).
    id_to_prof: dict = {}
    member_ids = [r["miembro_id"] for r in rows if r.get("miembro_id")]
    if member_ids:
        try:
            profs = (
                db()
                .table("profiles")
                .select("id, correo, nombre, apellido")
                .in_("id", member_ids)
                .execute()
                .data
                or []
            )
            id_to_prof = {p["id"]: p for p in profs}
        except Exception:
            id_to_prof = {}
    result = []
    for r in rows:
        prof = id_to_prof.get(r.get("miembro_id")) or {}
        result.append(
            {
                "id": r["id"],
                "miembro_id": r["miembro_id"],
                "token": r["token"],
                "estado": r["estado"],
                "created_at": r["created_at"],
                "correo": prof.get("correo"),
                "nombre": f"{prof.get('nombre') or ''} {prof.get('apellido') or ''}".strip()
                or prof.get("correo"),
            }
        )
    return {"compartidos": result, "max_miembros": MAX_MIEMBROS, "es_pro": _es_pro(user)}


@router.get("/inventario")
def ver_inventarios_compartidos(user: AuthUser = Depends(current_user)):
    """Lista los inventarios que me compartieron (soy miembro) con sus productos."""
    rows = (
        db()
        .table("shared_inventories")
        .select("owner_id, estado")
        .eq("miembro_id", user.id)
        .eq("estado", "activo")
        .execute()
        .data
        or []
    )
    owner_ids = [r["owner_id"] for r in rows if r.get("owner_id")]
    owners: dict = {}
    if owner_ids:
        try:
            profs = (
                db()
                .table("profiles")
                .select("id, correo, nombre, apellido, plan_id")
                .in_("id", owner_ids)
                .execute()
                .data
                or []
            )
            owners = {p["id"]: p for p in profs}
        except Exception:
            owners = {}
    inventarios = []
    for r in rows:
        owner = owners.get(r["owner_id"]) or {}
        owner_id = r["owner_id"]
        productos = (
            db()
            .table("productos")
            .select("id,nombre,unidad_medida,cantidad,cantidad_minima,precio_venta")
            .eq("owner_id", owner_id)
            .eq("activo", True)
            .order("nombre")
            .limit(1000)
            .execute()
            .data
            or []
        )
        inventarios.append(
            {
                "owner_id": owner_id,
                "owner_correo": owner.get("correo"),
                "owner_nombre": f"{owner.get('nombre') or ''} {owner.get('apellido') or ''}".strip()
                or owner.get("correo"),
                "productos": productos,
            }
        )
    return {"inventarios": inventarios}


@router.post("/link")
def generar_link(user: AuthUser = Depends(current_user)):
    """Genera un link de invitación para compartir mi inventario (solo Pro)."""
    if not _es_pro(user):
        raise HTTPException(403, "La compartición de inventario es una función del plan Pro.")
    try:
        activos = (
            db()
            .table("shared_inventories")
            .select("id", count="exact")
            .eq("owner_id", user.id)
            .eq("estado", "activo")
            .execute()
            .count
            or 0
        )
        pendientes = (
            db()
            .table("shared_inventories")
            .select("id", count="exact")
            .eq("owner_id", user.id)
            .eq("estado", "pendiente")
            .execute()
            .count
            or 0
        )
    except Exception:
        activos = pendientes = 0
    if activos + pendientes >= MAX_MIEMBROS:
        raise HTTPException(403, f"Ya compartiste tu inventario con {MAX_MIEMBROS} personas. Revocá un acceso para compartir con otra.")

    token = secrets.token_urlsafe(32)
    row = (
        db()
        .table("shared_inventories")
        .insert({"owner_id": user.id, "token": token, "estado": "pendiente"})
        .execute()
        .data
        or []
    )
    if not row:
        raise HTTPException(500, "No se pudo generar el link de compartición.")
    link = f"{_FRONTEND_URL}/compartir?token={token}"
    return {"ok": True, "link": link, "token": token, "id": row[0]["id"]}


@router.post("/vincular")
async def vincular_inventario(payload: BaseModel):
    token = getattr(payload, "token", "") or ""
    if not token:
        raise HTTPException(400, "El enlace de compartición es inválido.")
    share = (
        db()
        .table("shared_inventories")
        .select("id, owner_id, miembro_id, estado")
        .eq("token", token)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not share:
        raise HTTPException(404, "El enlace de compartición no existe o fue revocado.")
    share = share[0]
    # El dueño del token es el owner; el miembro se define al aceptarlo.
    return {"ok": True, "owner_id": share["owner_id"], "token": token, "estado": share["estado"]}


def _registrar_miembro(owner_id: str, miembro_id: str, token: str) -> None:
    db().table("shared_inventories").update({"miembro_id": miembro_id, "estado": "activo"}).eq("token", token).execute()


class VincularIn(BaseModel):
    token: str


@router.post("/aceptar")
def aceptar_inventario(payload: VincularIn, user: AuthUser = Depends(current_user)):
    if not payload.token:
        raise HTTPException(400, "El enlace de compartición es inválido.")
    share = (
        db()
        .table("shared_inventories")
        .select("id, owner_id, miembro_id, estado")
        .eq("token", payload.token)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not share:
        raise HTTPException(404, "El enlace de compartición no existe o fue revocado.")
    share = share[0]
    if share.get("miembro_id") and share.get("miembro_id") != user.id:
        raise HTTPException(409, "Este enlace ya fue utilizado por otra cuenta.")
    if share.get("owner_id") == user.id:
        raise HTTPException(400, "No podés compartir tu inventario con vos mismo.")

    _registrar_miembro(share["owner_id"], user.id, payload.token)

    # Copiar el plan del owner hacia el lector para que pueda operar el inventario
    # si el miembro tiene un plan gratuito (no aplica límite de productos en el inventario compartido).
    return {"ok": True, "owner_id": share["owner_id"]}


@router.post("/{share_id}/revocar")
def revocar_inventario(share_id: int, user: AuthUser = Depends(current_user)):
    result = (
        db()
        .table("shared_inventories")
        .update({"estado": "revocado"})
        .eq("id", share_id)
        .eq("owner_id", user.id)
        .execute()
    )
    if not result.data:
        raise HTTPException(404, "Compartición no encontrada.")
    return {"ok": True}
