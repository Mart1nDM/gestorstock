-- Migración: tabla pagos (pago único MercadoPago para planes Pro/Premium)
-- Ejecutar en Supabase SQL Editor contra la base existente.

create table if not exists public.pagos (
  id bigint generated always as identity primary key,
  mercadopago_id bigint unique,
  preferencia_id text,
  correo text not null,
  nombre text,
  apellido text,
  telefono text,
  plan_key text not null,
  monto numeric(14,2) not null,
  estado text not null default 'pending' check (estado in ('pending','approved','rejected','cancelled','refunded')),
  profile_id uuid references public.profiles(id) on delete set null,
  wallet_processed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ix_pagos_correo on public.pagos(correo);
create index if not exists ix_pagos_estado on public.pagos(estado);
