from datetime import date
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException

try:
    from .db import db
    from .deps import AuthUser, current_user
except ImportError:
    from db import db
    from deps import AuthUser, current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(user: AuthUser = Depends(current_user)):
    def fetch_rows(builder, label: str):
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                return builder.execute().data or []
            except (httpx.ReadError, httpx.RemoteProtocolError, httpx.ConnectError) as exc:
                last_error = exc
                if attempt == 2:
                    raise HTTPException(status_code=503, detail=f"No se pudo leer {label}. Reintentá en unos segundos.") from exc
                time.sleep(0.15 * (attempt + 1))
        if last_error:
            raise HTTPException(status_code=503, detail=f"No se pudo leer {label}.") from last_error
        return []

    products = fetch_rows(
        db().table("productos").select("nombre,categoria,cantidad,cantidad_minima,precio_costo,activo").eq("owner_id", user.id).eq("activo", True),
        "las métricas de stock",
    )
    sales = fetch_rows(
        db().table("ventas").select("nombre,cantidad,total,fecha").eq("owner_id", user.id),
        "las métricas de ventas",
    )

    total_productos = len(products)
    sin_stock = sum(1 for product in products if int(product.get("cantidad") or 0) == 0)
    stock_bajo = sum(
        1
        for product in products
        if int(product.get("cantidad") or 0) > 0
        and int(product.get("cantidad") or 0) <= int(product.get("cantidad_minima") or 0)
    )
    unidades = sum(int(product.get("cantidad") or 0) for product in products)
    valor_inventario = sum(float(product.get("precio_costo") or 0) * int(product.get("cantidad") or 0) for product in products)
    categorias = len({product.get("categoria") for product in products if product.get("categoria")})

    today_prefix = date.today().isoformat()
    ventas_hoy_rows = [sale for sale in sales if str(sale.get("fecha") or "").startswith(today_prefix)]
    ventas_hoy = len(ventas_hoy_rows)
    total_hoy = sum(float(sale.get("total") or 0) for sale in ventas_hoy_rows)
    historico_vendido = sum(float(sale.get("total") or 0) for sale in sales)
    unidades_vendidas = sum(int(sale.get("cantidad") or 0) for sale in sales)

    counts: dict[str, int] = {}
    for sale in sales:
        name = sale.get("nombre")
        if name:
            counts[name] = counts.get(name, 0) + int(sale.get("cantidad") or 0)
    producto_mas_vendido = max(counts, key=counts.get) if counts else None

    return {
        "stock": {
            "total_productos": total_productos,
            "sin_stock": sin_stock,
            "stock_bajo": stock_bajo,
            "unidades": unidades,
            "valor_inventario": valor_inventario,
        },
        "ventas": {
            "ventas_hoy": ventas_hoy,
            "total_hoy": total_hoy,
            "historico_vendido": historico_vendido,
            "unidades_vendidas": unidades_vendidas,
        },
        "categorias": categorias,
        "producto_mas_vendido": producto_mas_vendido,
    }
