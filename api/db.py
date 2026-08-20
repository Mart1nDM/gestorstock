from fastapi import HTTPException

try:
    from .deps import admin_client
except ImportError:
    from deps import admin_client


def db():
    if admin_client is None:
        raise HTTPException(status_code=500, detail="Supabase no esta configurado en el backend.")
    return admin_client
