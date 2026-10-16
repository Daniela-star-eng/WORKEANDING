-- =====================================================================
-- 01 · Registro e inicio de sesión: perfil automático + seguridad (RLS)
-- Ejecutar UNA vez en Supabase > SQL Editor (antes de 02_sprint3_perfil.sql)
-- =====================================================================

-- 1. Solo se permiten los dos tipos de usuario de la documentación
alter table public.usuarios
  add constraint usuarios_tipo_usuario_check
  check (tipo_usuario in ('CLIENTE', 'PRESTADOR'));

-- 2. Crear la fila en public.usuarios automáticamente al registrarse.
--    Los datos llegan desde options.data del signUp (raw_user_meta_data).
--    (02_sprint3_perfil.sql reemplaza esta función para guardar también
--    el teléfono y los datos del prestador.)
create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.usuarios (id, email, nombre, tipo_usuario)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''),
      split_part(new.email, '@', 1)
    ),
    case
      when new.raw_user_meta_data ->> 'tipo_usuario' in ('CLIENTE', 'PRESTADOR')
        then new.raw_user_meta_data ->> 'tipo_usuario'
      else 'CLIENTE'
    end
  );
  return new;
end;
$$;

create trigger al_crear_usuario_auth
  after insert on auth.users
  for each row execute function public.crear_perfil_usuario();

-- 3. Políticas: cada usuario solo puede ver y editar SU propio perfil
create policy "Usuarios ven su propio perfil"
on public.usuarios
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Usuarios actualizan su propio perfil"
on public.usuarios
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- 4. Evitar que un usuario se haga admin o se reactive la cuenta solo:
--    únicamente puede modificar estas columnas.
revoke update on public.usuarios from authenticated, anon;
grant update (nombre, tipo_usuario, fecha_nacimiento, latitud, longitud)
  on public.usuarios to authenticated;
