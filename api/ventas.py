from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

try:
    from .db import db
    from .deps import AuthUser, current_user
except ImportError:
    from db import db
    from deps import AuthUser, current_user

router = APIRouter(prefix="/api/ventas", tags=["ventas"])


class SaleIn(BaseModel):
    producto_id: int
    cantidad: int = Field(gt=0)
    precio_venta: float = Field(ge=0)


def _money(value: object) -> Decimal:
    return Decimal(str(value or "0")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@router.get("")
def list_sales(today: bool = False, user: AuthUser = Depends(current_user)):
    q = db().table("ventas").select("*").eq("owner_id", user.id).order("id", desc=True)
    if today:
        q = q.gte("fecha", date.today().isoformat())
    return q.limit(500).execute().data or []


@router.post("")
def register_sale(payload: SaleIn, user: AuthUser = Depends(current_user)):
    product_rows = (
        db()
        .table("productos")
        .select("*")
        .eq("id", payload.producto_id)
        .eq("owner_id", user.id)
        .eq("activo", True)
        .limit(1)
        .execute()
        .data
        or []
    )
    if not product_rows:
        raise HTTPException(404, "Producto no encontrado.")

    product = product_rows[0]
    stock = int(product.get("cantidad") or 0)
    if stock < payload.cantidad:
        raise HTTPException(409, "Stock insuficiente.")

    unit_price = _money(payload.precio_venta)
    total = _money(unit_price * Decimal(payload.cantidad))

    updated = (
        db()
        .table("productos")
        .update({"cantidad": stock - payload.cantidad})
        .eq("id", payload.producto_id)
        .eq("owner_id", user.id)
        .eq("activo", True)
        .execute()
        .data
        or []
    )
    if not updated:
        raise HTTPException(400, "No se pudo registrar la venta.")

    sale_rows = (
        db()
        .table("ventas")
        .insert(
            {
                "owner_id": user.id,
                "producto_id": payload.producto_id,
                "nombre": product.get("nombre"),
                "cantidad": payload.cantidad,
                "precio_venta": float(unit_price),
                "total": float(total),
            }
        )
        .execute()
        .data
        or []
    )
    if not sale_rows:
        raise HTTPException(400, "No se pudo registrar la venta.")

    return sale_rows[0]
