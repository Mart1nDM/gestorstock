from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

try:
    from .deps import current_user, AuthUser
    from .db import db
except ImportError:
    from deps import current_user, AuthUser
    from db import db

router = APIRouter(prefix="/api/productos", tags=["productos"])
SORTABLE = {"id","nombre","marca","categoria","sabor","cantidad","cantidad_minima","precio_costo","precio_venta","proveedor","fecha_ingreso","fecha_vencimiento"}

class ProductIn(BaseModel):
    nombre: str = Field(min_length=1)
    marca: str | None = None
    categoria: str | None = None
    sabor: str | None = None
    codigo_barras: str | None = None
    cantidad: int = Field(default=0, ge=0)
    cantidad_minima: int = Field(default=0, ge=0)
    precio_costo: float = Field(default=0, ge=0)
    precio_venta: float = Field(default=0, ge=0)
    proveedor: str | None = None
    unidad_medida: str | None = None
    ubicacion: str | None = None
    descripcion: str | None = None
    fecha_ingreso: str | None = None
    fecha_vencimiento: str | None = None

@router.get("")
def list_products(q: str = "", sort: str = "nombre", direction: Literal["asc","desc"] = "asc", user: AuthUser = Depends(current_user)):
    sort = sort if sort in SORTABLE else "nombre"
    query = db().table("productos").select("*").eq("owner_id", user.id).eq("activo", True)
    if q.strip():
        term = q.strip()
        query = query.or_(f"nombre.ilike.%{term}%,marca.ilike.%{term}%,categoria.ilike.%{term}%,codigo_barras.ilike.%{term}%,proveedor.ilike.%{term}%")
    query = query.order(sort, desc=direction == "desc")
    rows = query.limit(500).execute().data or []
    return rows

@router.get("/{product_id}")
def get_product(product_id: int, user: AuthUser = Depends(current_user)):
    row = db().table("productos").select("*").eq("id", product_id).eq("owner_id", user.id).single().execute().data
    if not row: raise HTTPException(404, "Producto no encontrado.")
    return row

@router.post("")
def create_product(payload: ProductIn, user: AuthUser = Depends(current_user)):
    data = payload.model_dump(); data["owner_id"] = user.id; data["activo"] = True
    try:
        result = db().table("productos").insert(data).execute()
        return result.data[0]
    except Exception as exc:
        if "duplicate" in str(exc).lower() or "unique" in str(exc).lower(): raise HTTPException(409, "Ya existe un producto con ese código de barras.")
        raise HTTPException(400, "No se pudo guardar el producto.") from exc

@router.put("/{product_id}")
def update_product(product_id: int, payload: ProductIn, user: AuthUser = Depends(current_user)):
    result = db().table("productos").update(payload.model_dump()).eq("id", product_id).eq("owner_id", user.id).eq("activo", True).execute()
    if not result.data: raise HTTPException(404, "Producto no encontrado.")
    return result.data[0]

@router.delete("/{product_id}")
def deactivate_product(product_id: int, user: AuthUser = Depends(current_user)):
    result = db().table("productos").update({"activo": False}).eq("id", product_id).eq("owner_id", user.id).execute()
    if not result.data: raise HTTPException(404, "Producto no encontrado.")
    return {"ok": True}
