-- Moralicuentos CRM · usuarios del panel
-- Login con usuario y contraseña guardados en la tabla public.usuarios.
-- La contraseña se guarda cifrada con bcrypt (pgcrypto), nunca en claro.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.usuarios (
  id uuid primary key default gen_random_uuid(),
  usuario text not null unique,
  password_hash text not null,
  rol text not null default 'admin',
  activo boolean not null default true,
  creado timestamptz not null default now()
);
alter table public.usuarios enable row level security;
-- Sin políticas: solo el servidor (service_role) puede leerla.
revoke all on public.usuarios from anon, authenticated;

-- Usuario inicial: admin / admin (cámbialo antes de usar la app con datos reales)
insert into public.usuarios (usuario, password_hash, rol)
values ('admin', extensions.crypt('admin', extensions.gen_salt('bf')), 'admin')
on conflict (usuario) do nothing;

-- Comprueba usuario y contraseña sin devolver nunca el hash.
create or replace function public.comprobar_login(p_usuario text, p_password text)
returns table (id uuid, usuario text, rol text)
language sql
security definer
set search_path = ''
as $$
  select u.id, u.usuario, u.rol
  from public.usuarios u
  where lower(u.usuario) = lower(p_usuario)
    and u.activo
    and u.password_hash = extensions.crypt(p_password, u.password_hash);
$$;
revoke execute on function public.comprobar_login(text, text) from public, anon, authenticated;
grant execute on function public.comprobar_login(text, text) to service_role;

-- Para cambiar la contraseña de admin:
-- update public.usuarios set password_hash = extensions.crypt('NUEVA', extensions.gen_salt('bf')) where usuario = 'admin';
