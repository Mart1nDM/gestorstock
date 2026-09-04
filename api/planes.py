from fastapi import APIRouter, Depends

try:
    from .deps import AuthUser, current_user
except ImportError:
    from deps import AuthUser, current_user

router = APIRouter(prefix="/api/planes", tags=["planes"])

PLAN_CATALOG = [
    {
        "key": "gratis",
        "nombre": "Gratis",
        "precio": "$0/mes",
        "subtitle": "Para empezar sin costo y ordenar el inventario básico.",
        "products": "Hasta 10 productos",
        "limite_productos": 10,
        "precio_mensual": 0,
        "accent": "var(--success)",
        "destacado": False,
        "soporte": {
            "nivel": "Estándar",
            "tiempo": "Respuesta en 72 h hábiles",
            "canal": ["Correo"],
            "personalizado": False,
            "prioridad": "Normal",
        },
        "metas_ventas": False,
        "reportes": ["Métricas básicas"],
        "graficas": ["Resumen simple"],
        "features": [
            "Control de stock esencial",
            "Alta y edición de productos",
            "Vista simple de métricas",
        ],
        "limites": {
            "productos": 10,
            "usuarios": 1,
            "historial_ventas": "30 días",
        },
    },
    {
        "key": "premium",
        "nombre": "Premium",
        "precio": "$5099,99/mes",
        "subtitle": "Más capacidad para crecer con datos más claros.",
        "products": "Hasta 100 productos",
        "limite_productos": 100,
        "precio_mensual": 5099.99,
        "accent": "var(--accent)",
        "destacado": True,
        "soporte": {
            "nivel": "Prioritario",
            "tiempo": "Respuesta en 24 h hábiles",
            "canal": ["Correo", "WhatsApp"],
            "personalizado": False,
            "prioridad": "Alta",
        },
        "metas_ventas": True,
        "reportes": ["Métricas avanzadas", "Gráficas de ventas"],
        "graficas": ["Torta por categoría", "Progreso de ventas", "Metas de ventas"],
        "features": [
            "Más métricas y gráficos",
            "Seguimiento de stock bajo",
            "Metas de ventas mensuales",
            "Panel con análisis visual",
        ],
        "limites": {
            "productos": 100,
            "usuarios": 1,
            "historial_ventas": "Histórico completo",
        },
    },
    {
        "key": "pro",
        "nombre": "Pro",
        "precio": "$9999,99/mes",
        "subtitle": "Para operación completa, análisis y soporte más cercano.",
        "products": "Productos ilimitados",
        "limite_productos": None,
        "precio_mensual": 9999.99,
        "accent": "var(--warning)",
        "destacado": False,
        "soporte": {
            "nivel": "VIP / Personalizado",
            "tiempo": "Respuesta en 8 h hábiles",
            "canal": ["Correo", "WhatsApp", "Teléfono"],
            "personalizado": True,
            "prioridad": "Máxima",
        },
        "metas_ventas": True,
        "reportes": ["Reportes de ventas", "Gráficos de análisis", "Análisis avanzado"],
        "graficas": ["Torta por categoría", "Progreso de ventas", "Metas de ventas", "Análisis histórico"],
        "features": [
            "Reportes de ventas",
            "Gráficos de análisis",
            "Metas de ventas avanzadas",
            "Soporte personalizado",
            "Inventario compartido (hasta 5 personas)",
            "Reporte PDF por período",
        ],
        "limites": {
            "productos": None,
            "usuarios": 1,
            "historial_ventas": "Histórico completo",
            "inventario_compartido": 5,
            "reporte_pdf": True,
        },
    },
]


def _plan_key_from_nombre(nombre: str | None) -> str:
    if not nombre:
        return "gratis"
    n = nombre.strip().lower()
    if n == "pro":
        return "pro"
    if n == "premium":
        return "premium"
    return "gratis"


@router.get("")
def list_planes():
    return {"planes": PLAN_CATALOG}


@router.get("/me")
def my_plan(user: AuthUser = Depends(current_user)):
    key = _plan_key_from_nombre(user.profile.get("plan_nombre"))
    plan = next((p for p in PLAN_CATALOG if p["key"] == key), PLAN_CATALOG[0])
    return {"plan": plan}
