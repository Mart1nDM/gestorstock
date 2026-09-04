from __future__ import annotations

import io
from datetime import date, datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel

try:
    from .db import db
    from .deps import AuthUser, current_user
    from .spam_protection import verify_turnstile
except ImportError:
    from db import db
    from deps import AuthUser, current_user
    from spam_protection import verify_turnstile


router = APIRouter(prefix="/api/reportes", tags=["reportes"])

PERIODOS = {"diario": 0, "semanal": 7, "mensual": 30, "anual": 365}


def _plan_key(profile: dict) -> str:
    n = str(profile.get("plan_nombre") or "").strip().lower()
    return n if n in ("premium", "pro", "gratis") else "gratis"


def _es_pro(user: AuthUser) -> bool:
    return _plan_key(user.profile) == "pro" or user.profile.get("rol") == "superadmin"


def _rango(periodo: str) -> tuple[datetime, datetime]:
    hoy = date.today()
    if periodo == "diario":
        start = datetime(hoy.year, hoy.month, hoy.day, tzinfo=timezone.utc)
        return start, start + timedelta(days=1)
    if periodo == "semanal":
        start = universe_week_start(hoy)
        return start, start + timedelta(days=7)
    if periodo == "mensual":
        start = datetime(hoy.year, hoy.month, 1, tzinfo=timezone.utc)
        next_month = hoy.month + 1
        return start, start.replace(year=hoy.year + (next_month // 12), month=(next_month % 12) or 1, day=1)
    # anual
    start = datetime(hoy.year, 1, 1, tzinfo=timezone.utc)
    return start, datetime(hoy.year + 1, 1, 1, tzinfo=timezone.utc)


def universe_week_start(d: date) -> datetime:
    # lunes como inicio de semana
    start = d - timedelta(days=d.weekday())
    return datetime(start.year, start.month, start.day, tzinfo=timezone.utc)


class ReporteIn(BaseModel):
    periodo: str
    cf_turnstile_response: str | None = None


def _agregar_fila(builder, titulo: str, desde: datetime, hasta: datetime):
    return builder.gte("fecha", desde.isoformat()).lt("fecha", hasta.isoformat())


def _datos_reporte(user: AuthUser, periodo: str) -> dict:
    desde, hasta = _rango(periodo)

    sales = (
        db()
        .table("ventas")
        .select("nombre, cantidad, total, fecha")
        .eq("owner_id", user.id)
        .gte("fecha", desde.isoformat())
        .lt("fecha", hasta.isoformat())
        .order("fecha")
        .limit(5000)
        .execute()
        .data
        or []
    )

    products = (
        db()
        .table("productos")
        .select("nombre, cantidad, precio_costo, cantidad_minima")
        .eq("owner_id", user.id)
        .eq("activo", True)
        .limit(5000)
        .execute()
        .data
        or []
    )

    unidades_vendidas = sum(int(s.get("cantidad") or 0) for s in sales)
    total_vendido = sum(float(s.get("total") or 0) for s in sales)
    cantidad_ventas = len(sales)

    # Top productos por ingresos en el período
    por_producto: dict[str, dict] = {}
    for s in sales:
        nombre = s.get("nombre") or "Sin nombre"
        item = por_producto.setdefault(nombre, {"cantidad": 0, "total": 0.0})
        item["cantidad"] += int(s.get("cantidad") or 0)
        item["total"] += float(s.get("total") or 0)
    top_productos = sorted(por_producto.items(), key=lambda kv: kv[1]["total"], reverse=True)[:15]

    stock_actual = sum(int(p.get("cantidad") or 0) for p in products)
    valor_inventario = sum(float(p.get("precio_costo") or 0) * int(p.get("cantidad") or 0) for p in products)
    stock_bajo = [p for p in products if int(p.get("cantidad") or 0) <= int(p.get("cantidad_minima") or 0)]

    ventas_por_dia: dict[str, float] = {}
    for s in sales:
        dia = str(s.get("fecha") or "")[:10]
        ventas_por_dia[dia] = ventas_por_dia.get(dia, 0) + float(s.get("total") or 0)

    return {
        "periodo": periodo,
        "desde": desde,
        "hasta": hasta,
        "unidades_vendidas": unidades_vendidas,
        "total_vendido": total_vendido,
        "cantidad_ventas": cantidad_ventas,
        "top_productos": [{"nombre": n, **v} for n, v in top_productos],
        "stock_actual": stock_actual,
        "valor_inventario": valor_inventario,
        "stock_bajo": len(stock_bajo),
        "ventas_por_dia": ventas_por_dia,
        "cantidad_productos": len(products),
    }


def _label_periodo(periodo: str) -> str:
    return {"diario": "Diario", "semanal": "Semanal", "mensual": "Mensual", "anual": "Anual"}.get(periodo, periodo)


def _money(v) -> str:
    return f"${float(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


@router.post("")
def descargar_reporte(payload: ReporteIn, request: Request, user: AuthUser = Depends(current_user)):
    if not _es_pro(user):
        raise HTTPException(403, "El reporte PDF es una función del plan Pro.")
    if payload.periodo not in PERIODOS:
        raise HTTPException(400, "Seleccioná un período válido (diario, semanal, mensual o anual).")

    if not verify_turnstile(payload.cf_turnstile_response, request.client.host if request.client else None):
        raise HTTPException(403, "No se pudo verificar que no sos un robot. Intentá de nuevo.")

    datos = _datos_reporte(user, payload.periodo)

    pdf = _build_pdf(datos, user)
    filename = f"reporte_{payload.periodo}_{date.today().isoformat()}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _build_pdf(datos: dict, user: AuthUser) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, rightMargin=16 * mm, leftMargin=16 * mm, topMargin=16 * mm, bottomMargin=16 * mm)

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("TitleX", parent=styles["Title"], fontSize=18, spaceAfter=4)
    sub_style = ParagraphStyle("SubX", parent=styles["Normal"], fontSize=10, textColor=colors.grey, spaceAfter=12)
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=12, spaceBefore=12, spaceAfter=6, textColor=colors.HexColor("#1d4ed8"))

    nombre = f"{user.profile.get('nombre') or ''} {user.profile.get('apellido') or ''}".strip() or user.email
    desde = datos["desde"].strftime("%d/%m/%Y")
    hasta = datos["hasta"].strftime("%d/%m/%Y")

    story = [
        Paragraph("Gestor Stock - MartoTech", title_style),
        Paragraph(f"Reporte {_label_periodo(datos['periodo'])} · {nombre} · {desde} al {hasta}", sub_style),
    ]

    # Resumen
    resumen = Table(
        [
            ["Ventas realizadas", _money(datos["total_vendido"])],
            ["Unidades vendidas", f"{datos['unidades_vendidas']:,}".replace(",", ".")],
            ["Operaciones", f"{datos['cantidad_ventas']:,}".replace(",", ".")],
            ["Stock total unidades", f"{datos['stock_actual']:,}".replace(",", ".")],
            ["Valor de inventario (costo)", _money(datos["valor_inventario"])],
            ["Productos con stock bajo", f"{datos['stock_bajo']}"],
            ["Productos activos", f"{datos['cantidad_productos']:,}".replace(",", ".")],
        ],
        colWidths=[90 * mm, None],
    )
    resumen.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef2ff")),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(Paragraph("Resumen del período", h2))
    story.append(resumen)

    # Ventas por día
    story.append(Paragraph("Ventas por día (ARS)", h2))
    dias = sorted(datos["ventas_por_dia"].items())
    if dias:
        tabla_dias = Table(
            [[d[7:] + d[5:7] + "/" + d[:4] if len(d) == 10 else d, _money(v)] for d, v in dias],
            colWidths=[90 * mm, None],
        )
        tabla_dias.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
            ("BACKGROUND", (0, 0), (-1, -1), colors.white),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(tabla_dias)
    else:
        story.append(Paragraph("Sin ventas en el período.", styles["Normal"]))

    # Top productos
    story.append(Paragraph("Top productos vendidos", h2))
    if datos["top_productos"]:
        tabla_top = Table(
            [["Producto", "Unidades", "Ingresos"]] + [[r["nombre"], f"{r['cantidad']:,}".replace(",", "."), _money(r["total"])] for r in datos["top_productos"]],
            colWidths=[70 * mm, None, None],
        )
        tabla_top.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1d4ed8")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(tabla_top)
    else:
        story.append(Paragraph("Sin datos de ventas.", styles["Normal"]))

    story.append(Spacer(1, 8))
    story.append(Paragraph(f"Generado el {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M')} · Gestor Stock", sub_style))

    doc.build(story)
    return buf.getvalue()
