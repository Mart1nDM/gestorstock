from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from .auth import router as auth_router
    from .productos import router as productos_router
    from .ventas import router as ventas_router
    from .usuarios import router as usuarios_router
    from .dashboard import router as dashboard_router
    from .planes import router as planes_router
    from .metas import router as metas_router
    from .pagos import router as pagos_router
    from .db import db
except ImportError:  # Vercel deploys api/index.py as a top-level module
    from auth import router as auth_router
    from productos import router as productos_router
    from ventas import router as ventas_router
    from usuarios import router as usuarios_router
    from dashboard import router as dashboard_router
    from planes import router as planes_router
    from metas import router as metas_router
    from pagos import router as pagos_router
    from db import db

app = FastAPI(title="Gestor Stock API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])
app.include_router(auth_router)
app.include_router(productos_router)
app.include_router(ventas_router)
app.include_router(usuarios_router)
app.include_router(dashboard_router)
app.include_router(planes_router)
app.include_router(metas_router)
app.include_router(pagos_router)

@app.get("/api/health")
def health(): return {"ok": True, "service": "gestor-stock-api"}

# Vercel can mount this FastAPI ASGI app from api/index.py.
