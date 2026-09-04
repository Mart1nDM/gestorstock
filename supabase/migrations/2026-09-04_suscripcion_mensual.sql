-- ============================================================
-- Migración: Suscripción mensual + Inventario compartido
-- Ejecutar UNA sola vez en Supabase → SQL Editor (pestaña "SQL")
-- ============================================================

-- ---------- 1) SUSCRIPCIÓN MENSUAL ----------
-- pagos: guardar id de la suscripción de MercadoPago
ALTER TABLE public.pagos ADD COLUMN IF NOT EXISTS subscription_id text;
-- pagos: marca que la fila corresponde a una suscripción recurrente
ALTER TABLE public.pagos ADD COLUMN IF NOT EXISTS recurrente boolean NOT NULL DEFAULT false;

-- profiles: estado de la suscripción del usuario
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'inactive';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;

-- ---------- 2) INVENTARIO COMPARTIDO (plan Pro) ----------
-- Tabla que relaciona quién comparte su inventario (owner) con cada miembro (miembro).
-- Un owner puede compartir con hasta 5 miembros (se valida en la app).
-- miembro_id es NULL mientras la invitación está pendiente (solo se tiene el token).
CREATE TABLE IF NOT EXISTS public.shared_inventories (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  miembro_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,          -- código único del link de invitación
  estado text NOT NULL DEFAULT 'pendiente'
            CHECK (estado IN ('pendiente','activo','revocado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Permite que un owner repita con distinto token pero no duplique con el mismo miembro activo
CREATE UNIQUE INDEX IF NOT EXISTS ux_shared_inv_owner_miembro_activo
  ON public.shared_inventories(owner_id, miembro_id)
  WHERE miembro_id IS NOT NULL AND estado = 'activo';

CREATE INDEX IF NOT EXISTS ix_shared_inv_owner ON public.shared_inventories(owner_id);
CREATE INDEX IF NOT EXISTS ix_shared_inv_miembro ON public.shared_inventories(miembro_id);
CREATE INDEX IF NOT EXISTS ix_shared_inv_token ON public.shared_inventories(token);

-- RLS preparado para acceso futuro de la app
ALTER TABLE public.shared_inventories ENABLE ROW LEVEL SECURITY;
