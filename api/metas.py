from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

try:
    from .db import db
    from .deps import AuthUser, current_user
except ImportError:
    from db import db
    from deps import AuthUser, current_user

router = APIRouter(prefix="/api/metas", tags=["metas"])


def current_period() -> str:
    return date.today().strftime("%Y-%m")


class MetaIn(BaseModel):
    meta: float
    periodo: str | None = None


@router.get("")
def get_metas(user: AuthUser = Depends(current_user)):
    periodo = current_period()
    try:
        rows = db().table("sales_goals").select("*").eq("owner_id", user.id).order("periodo", desc=True).execute().data or []
    except Exception:
        rows = []

    current_goal = next((r for r in rows if r.get("periodo") == periodo), None)
    meta_actual = float(current_goal["meta"]) if current_goal else 0.0

    try:
        sales_rows = db().table("ventas").select("total,fecha").eq("owner_id", user.id).execute().data or []
    except Exception:
        sales_rows = []

    total_periodo = sum(
        float(s.get("total") or 0)
        for s in sales_rows
        if str(s.get("fecha") or "").startswith(periodo)
    )

    return {
        "periodo": periodo,
        "meta_actual": meta_actual,
        "total_periodo": total_periodo,
        "progreso": round((total_periodo / meta_actual) * 100, 1) if meta_actual > 0 else None,
        "historial": [
            {
                "periodo": r["periodo"],
                "meta": float(r["meta"]),
            }
            for r in rows
        ],
    }


@router.put("")
def set_meta(payload: MetaIn, user: AuthUser = Depends(current_user)):
    if payload.meta < 0:
        raise HTTPException(400, "La meta no puede ser negativa.")
    periodo = payload.periodo or current_period()

    try:
        existing = db().table("sales_goals").select("id").eq("owner_id", user.id).eq("periodo", periodo).limit(1).execute().data or []
    except Exception as exc:
        raise HTTPException(500, "Falta crear la tabla sales_goals en Supabase. Revisá el schema.sql.") from exc

    if existing:
        db().table("sales_goals").update({"meta": payload.meta, "periodo": periodo}).eq("id", existing[0]["id"]).execute()
    else:
        db().table("sales_goals").insert({"owner_id": user.id, "periodo": periodo, "meta": payload.meta}).execute()

    return {"ok": True, "periodo": periodo, "meta": payload.meta}
