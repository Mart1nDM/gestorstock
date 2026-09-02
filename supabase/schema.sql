-- Gestor Stock / MartoTech
-- Ejecutar en Supabase SQL Editor.
-- Esta versión conserva los campos principales de la app de escritorio y agrega multi-tenant.

create extension if not exists pgcrypto;

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  apellido text,
  correo text not null,
  telefono text,
  rol text not null default 'cliente' check (rol in ('cliente','superadmin')),
  plan_id uuid references public.plans(id) on delete set null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.productos (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  nombre text not null,
  marca text,
  categoria text,
  sabor text,
  codigo_barras text,
  cantidad integer not null default 0 check (cantidad >= 0),
  cantidad_minima integer not null default 0 check (cantidad_minima >= 0),
  precio_costo numeric(14,2) not null default 0 check (precio_costo >= 0),
  precio_venta numeric(14,2) not null default 0 check (precio_venta >= 0),
  proveedor text,
  unidad_medida text,
  ubicacion text,
  descripcion text,
  fecha_ingreso text,
  fecha_vencimiento text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists ux_productos_owner_codigo on public.productos(owner_id, codigo_barras) where codigo_barras is not null and codigo_barras <> '';
create index if not exists ix_productos_owner on public.productos(owner_id, activo);
create index if not exists ix_productos_nombre on public.productos using gin (to_tsvector('simple', coalesce(nombre,'')));

create table if not exists public.ventas (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  producto_id bigint not null references public.productos(id) on delete restrict,
  nombre text not null,
  cantidad integer not null check (cantidad > 0),
  precio_venta numeric(14,2) not null default 0 check (precio_venta >= 0),
  total numeric(14,2) not null default 0,
  fecha timestamptz not null default now()
);
create index if not exists ix_ventas_owner_fecha on public.ventas(owner_id, fecha desc);

create table if not exists public.contact_requests (
  id bigint generated always as identity primary key,
  nombre text not null,
  correo text not null,
  telefono text,
  plan text,
  mensaje text not null,
  estado text not null default 'nuevo' check (estado in ('nuevo','contactado','cerrado')),
  creado_en timestamptz not null default now()
);

create table if not exists public.account_invitations (
  id bigint generated always as identity primary key,
  request_id bigint unique references public.contact_requests(id) on delete set null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  nombre text not null,
  correo text not null,
  telefono text,
  plan text,
  invite_url text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','completada')),
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);
create index if not exists ix_account_invitations_profile_estado on public.account_invitations(profile_id, estado);
create index if not exists ix_account_invitations_request on public.account_invitations(request_id);

create table if not exists public.sales_goals (
  id bigint generated always as identity primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  periodo text not null,
  meta numeric(14,2) not null default 0 check (meta >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, periodo)
);
create index if not exists ix_sales_goals_owner on public.sales_goals(owner_id, periodo);

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

insert into public.plans (nombre, descripcion)
values ('Plan a definir', 'Plan comercial pendiente de definir por el administrador.')
on conflict (nombre) do nothing;

create or replace function public.register_sale(
  p_owner_id uuid,
  p_producto_id bigint,
  p_cantidad integer,
  p_precio_venta numeric
)
returns table (
  id bigint,
  producto_id bigint,
  nombre text,
  cantidad integer,
  precio_venta numeric,
  total numeric,
  fecha timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  new_sale public.ventas%rowtype;
begin
  select * into p
  from public.productos
  where id = p_producto_id
    and owner_id = p_owner_id
    and activo = true
  for update;

  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  if p.cantidad < p_cantidad then
    raise exception 'INSUFFICIENT_STOCK';
  end if;

  update public.productos
  set cantidad = cantidad - p_cantidad,
      updated_at = now()
  where id = p_producto_id;

  insert into public.ventas(owner_id, producto_id, nombre, cantidad, precio_venta, total)
  values (p_owner_id, p_producto_id, p.nombre, p_cantidad, p_precio_venta, p_cantidad * p_precio_venta)
  returning * into new_sale;

  return query select new_sale.id, new_sale.producto_id, new_sale.nombre,
    new_sale.cantidad, new_sale.precio_venta, new_sale.total, new_sale.fecha;
end;
$$;

-- La RPC de ventas se ejecuta desde FastAPI con la secret key.
revoke execute on function public.register_sale(uuid, bigint, integer, numeric) from public, anon, authenticated;
grant execute on function public.register_sale(uuid, bigint, integer, numeric) to service_role;

-- RLS: aunque FastAPI utiliza una clave de servidor para operaciones controladas,
-- dejamos la base preparada para acceso directo autenticado en el futuro.
alter table public.profiles enable row level security;
alter table public.productos enable row level security;
alter table public.ventas enable row level security;
alter table public.plans enable row level security;
alter table public.contact_requests enable row level security;
alter table public.account_invitations enable row level security;
alter table public.sales_goals enable row level security;

create policy "profiles own row" on public.profiles for select to authenticated using (id = auth.uid());
create policy "products own rows" on public.productos for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "sales own rows" on public.ventas for select to authenticated using (owner_id = auth.uid());
create policy "plans readable" on public.plans for select to authenticated using (true);
create policy "goals own rows" on public.sales_goals for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Importante: el rol superadmin NO depende de user_metadata. Se controla en profiles.
-- Para crear el primer superadmin, creá el usuario en Supabase Auth y luego ejecutá:
-- update public.profiles set rol = 'superadmin' where correo = 'TU_CORREO';

