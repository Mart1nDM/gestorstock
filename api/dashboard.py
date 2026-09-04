from datetime import date, timedelta
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
        db().table("productos").select("id,nombre,categoria,cantidad,cantidad_minima,precio_costo,precio_venta,activo").eq("owner_id", user.id).eq("activo", True),
        "las métricas de stock",
    )
    sales = fetch_rows(
        db().table("ventas").select("producto_id,nombre,cantidad,total,fecha").eq("owner_id", user.id),
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
    def precio_valor(p):
        return float(p.get("precio_venta") or 0) if float(p.get("precio_venta") or 0) > 0 else float(p.get("precio_costo") or 0)
    valor_inventario = sum(precio_valor(product) * int(product.get("cantidad") or 0) for product in products)
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

    product_by_id = {int(p["id"]): p for p in products if p.get("id") is not None}
    category_by_product = {
        int(s["producto_id"]): (product_by_id.get(int(s["producto_id"]) or 0) or {}).get("categoria")
        for s in sales
        if s.get("producto_id") is not None
    }

    days = 14
    ventas_por_dia: list[dict] = []
    for i in range(days - 1, -1, -1):
        day = date.today() - timedelta(days=i)
        prefix = day.isoformat()
        total = sum(float(s.get("total") or 0) for s in sales if str(s.get("fecha") or "").startswith(prefix))
        ventas_por_dia.append({"dia": day.strftime("%d/%m"), "total": round(total, 2)})

    ventas_por_categoria: dict[str, float] = {}
    unidades_por_categoria: dict[str, int] = {}
    for sale in sales:
        pid = int(sale.get("producto_id") or 0)
        categoria = category_by_product.get(pid) or "Sin categoría"
        ventas_por_categoria[categoria] = ventas_por_categoria.get(categoria, 0) + float(sale.get("total") or 0)
        unidades_por_categoria[categoria] = unidades_por_categoria.get(categoria, 0) + int(sale.get("cantidad") or 0)

    stock_por_categoria: dict[str, int] = {}
    valor_por_categoria: dict[str, float] = {}
    for product in products:
        categoria = product.get("categoria") or "Sin categoría"
        stock_por_categoria[categoria] = stock_por_categoria.get(categoria, 0) + int(product.get("cantidad") or 0)
        valor_por_categoria[categoria] = valor_por_categoria.get(categoria, 0) + precio_valor(product) * int(product.get("cantidad") or 0)

    def to_pie(data: dict) -> list[dict]:
        return [{"name": k, "value": round(v, 2)} for k, v in sorted(data.items(), key=lambda kv: kv[1], reverse=True)]

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
        "graficas": {
            "ventas_por_dia": ventas_por_dia,
            "ventas_por_categoria": to_pie(ventas_por_categoria),
            "unidades_por_categoria": to_pie(unidades_por_categoria),
            "stock_por_categoria": to_pie(stock_por_categoria),
            "valor_por_categoria": to_pie(valor_por_categoria),
            "composicion_stock": [
                {"name": "En stock", "value": unidades - sin_stock - stock_bajo},
                {"name": "Stock bajo", "value": stock_bajo},
                {"name": "Sin stock", "value": sin_stock},
            ],
        },
    }
