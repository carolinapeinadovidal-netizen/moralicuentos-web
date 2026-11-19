-- Moralicuentos CRM · esquema inicial
-- Ejecutar en Supabase: SQL Editor > New query > pegar y Run.

-- ---------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------
create table if not exists public.cuentos (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null check (length(trim(titulo)) > 0),
  edad        text not null default '4–6' check (edad in ('2–4','4–6','6–9')),
  valor       text not null default 'Empatía',
  estado      text not null default 'borrador' check (estado in ('borrador','publicado')),
  video       text not null default '',
  descripcion text not null default '',
  sinopsis    text not null default '',
  actividad   text not null default '',
  pregunta    text not null default '',
  moraleja    text not null default '',
  vistas      integer not null default 0 check (vistas >= 0),
  creado      date not null default current_date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.familias (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null check (length(trim(nombre)) > 0),
  email       text,
  etapa       text not null default 'interesada'
              check (etapa in ('interesada','registrada','suscriptora','inactiva')),
  personaje   text not null default 'sin empezar'
              check (personaje in ('sin empezar','cuestionario enviado','cuestionario recibido','personaje listo')),
  notas       text not null default '',
  proximo     date,
  alta        date not null default current_date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists familias_email_idx on public.familias (lower(email));
create index if not exists familias_etapa_idx on public.familias (etapa);

create table if not exists public.hijos (
  id          uuid primary key default gen_random_uuid(),
  familia_id  uuid not null references public.familias(id) on delete cascade,
  nombre      text not null default '',
  edad        smallint check (edad between 1 and 12),
  orden       integer not null default 0
);
create index if not exists hijos_familia_idx on public.hijos (familia_id);

create table if not exists public.interacciones (
  id          uuid primary key default gen_random_uuid(),
  familia_id  uuid not null references public.familias(id) on delete cascade,
  fecha       date not null default current_date,
  tipo        text not null default 'Nota' check (tipo in ('Email','WhatsApp','Llamada','Reunión','Nota')),
  texto       text not null default '',
  orden       integer not null default 0
);
create index if not exists interacciones_familia_idx on public.interacciones (familia_id);

create table if not exists public.favoritos (
  familia_id  uuid not null references public.familias(id) on delete cascade,
  cuento_id   uuid not null references public.cuentos(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (familia_id, cuento_id)
);

-- ---------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists cuentos_updated on public.cuentos;
create trigger cuentos_updated before update on public.cuentos
  for each row execute function public.set_updated_at();

drop trigger if exists familias_updated on public.familias;
create trigger familias_updated before update on public.familias
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- Funciones que usa el servidor
-- ---------------------------------------------------------------

-- Guarda una familia con sus peques, historial y favoritos en una sola transacción.
create or replace function public.guardar_familia(p jsonb) returns uuid
language plpgsql as $$
declare
  fid uuid := (p->>'id')::uuid;
begin
  insert into public.familias (id, nombre, email, etapa, personaje, notas, proximo, alta)
  values (
    fid,
    p->>'nombre',
    nullif(trim(p->>'email'), ''),
    coalesce(nullif(p->>'etapa',''), 'interesada'),
    coalesce(nullif(p->>'personaje',''), 'sin empezar'),
    coalesce(p->>'notas', ''),
    nullif(p->>'proximo', '')::date,
    coalesce(nullif(p->>'alta', '')::date, current_date)
  )
  on conflict (id) do update set
    nombre    = excluded.nombre,
    email     = excluded.email,
    etapa     = excluded.etapa,
    personaje = excluded.personaje,
    notas     = excluded.notas,
    proximo   = excluded.proximo;

  delete from public.hijos where familia_id = fid;
  insert into public.hijos (familia_id, nombre, edad, orden)
  select fid, coalesce(t.h->>'nombre',''), nullif(t.h->>'edad','')::smallint, (t.i - 1)::int
  from jsonb_array_elements(coalesce(p->'hijos','[]'::jsonb)) with ordinality as t(h, i);

  delete from public.interacciones where familia_id = fid;
  insert into public.interacciones (familia_id, fecha, tipo, texto, orden)
  select fid,
         coalesce(nullif(t.x->>'fecha','')::date, current_date),
         coalesce(nullif(t.x->>'tipo',''), 'Nota'),
         coalesce(t.x->>'texto',''),
         (t.i - 1)::int
  from jsonb_array_elements(coalesce(p->'interacciones','[]'::jsonb)) with ordinality as t(x, i);

  delete from public.favoritos where familia_id = fid;
  insert into public.favoritos (familia_id, cuento_id)
  select distinct fid, c.id
  from jsonb_array_elements_text(coalesce(p->'favoritos','[]'::jsonb)) as f(cid)
  join public.cuentos c on c.id::text = f.cid;

  return fid;
end $$;

-- Suma una visita a un cuento publicado (la usa la app pública).
create or replace function public.incrementar_vistas(cuento uuid) returns void
language sql as $$
  update public.cuentos set vistas = vistas + 1 where id = cuento and estado = 'publicado';
$$;

-- ---------------------------------------------------------------
-- Seguridad
-- Solo el servidor (clave service_role) toca estas tablas. Con RLS activado y sin
-- políticas, la clave pública (anon) y los usuarios autenticados no ven nada.
-- ---------------------------------------------------------------
alter table public.cuentos        enable row level security;
alter table public.familias       enable row level security;
alter table public.hijos          enable row level security;
alter table public.interacciones  enable row level security;
alter table public.favoritos      enable row level security;

revoke execute on function public.guardar_familia(jsonb)    from public, anon, authenticated;
revoke execute on function public.incrementar_vistas(uuid)  from public, anon, authenticated;
grant  execute on function public.guardar_familia(jsonb)    to service_role;
grant  execute on function public.incrementar_vistas(uuid)  to service_role;
