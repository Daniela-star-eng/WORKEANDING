-- =====================================================================
-- 02 · Sprint 3 · Gestión de perfil (PB04 / HU01) + datos del registro
-- Ejecutar UNA vez en Supabase > SQL Editor, DESPUÉS de 01_auth_usuarios.sql
--
-- Incluye:
--   1. Columnas nuevas de public.usuarios (telefono, foto_url, actualizado_en)
--   2. Trigger validar_perfil_usuario (reglas del perfil, mensajes en español)
--   3. Tabla public.prestadores (categoría, experiencia, herramientas, identificación)
--   4. Nueva versión de crear_perfil_usuario (guarda teléfono y datos del prestador)
--   5. Permisos por columna
--   6. Buckets de Storage: avatares (público) e identificaciones (privado)
--
-- Los errores de validación usan el código 22023 (PostgREST responde 400) y
-- en HINT el nombre del campo, que la app usa para marcarlo en rojo
-- (ver traducirErrorPerfil en src/services/perfil.ts).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Columnas nuevas
-- ---------------------------------------------------------------------
alter table public.usuarios
  add column if not exists telefono       text,
  add column if not exists foto_url       text,
  add column if not exists actualizado_en timestamptz not null default now();


-- ---------------------------------------------------------------------
-- 2. Validación y normalización del perfil (la BD es la que manda)
-- ---------------------------------------------------------------------
create or replace function public.validar_perfil_usuario()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Nombre: obligatorio, 2 a 80 caracteres, sin espacios a los lados
  new.nombre := trim(coalesce(new.nombre, ''));
  if char_length(new.nombre) < 2 then
    raise exception 'Ingresa tu nombre (mínimo 2 caracteres).'
      using errcode = '22023', hint = 'nombre';
  end if;
  if char_length(new.nombre) > 80 then
    raise exception 'El nombre no puede tener más de 80 caracteres.'
      using errcode = '22023', hint = 'nombre';
  end if;

  -- Teléfono: opcional; se guardan solo dígitos (y + inicial), 10 a 15 dígitos
  if new.telefono is not null then
    new.telefono := regexp_replace(new.telefono, '[\s\-()]', '', 'g');
    if new.telefono = '' then
      new.telefono := null;
    elsif new.telefono !~ '^\+?[0-9]{10,15}$' then
      raise exception 'El teléfono debe tener entre 10 y 15 dígitos.'
        using errcode = '22023', hint = 'telefono';
    end if;
  end if;

  -- Fecha de nacimiento: no futura ni de hace más de 120 años
  if new.fecha_nacimiento is not null then
    if new.fecha_nacimiento > current_date then
      raise exception 'La fecha de nacimiento no puede estar en el futuro.'
        using errcode = '22023', hint = 'fecha_nacimiento';
    end if;
    if new.fecha_nacimiento < current_date - interval '120 years' then
      raise exception 'La fecha de nacimiento no es válida.'
        using errcode = '22023', hint = 'fecha_nacimiento';
    end if;
  end if;

  -- Tipo de usuario
  if new.tipo_usuario is null or new.tipo_usuario not in ('CLIENTE', 'PRESTADOR') then
    raise exception 'El tipo de usuario debe ser CLIENTE o PRESTADOR.'
      using errcode = '22023', hint = 'tipo_usuario';
  end if;

  -- Ubicación aproximada: latitud y longitud van juntas, se guardan con 3 decimales (~100 m)
  if (new.latitud is null) <> (new.longitud is null) then
    raise exception 'La ubicación debe incluir latitud y longitud.'
      using errcode = '22023', hint = 'ubicacion';
  end if;
  if new.latitud is not null then
    if new.latitud < -90 or new.latitud > 90 then
      raise exception 'La latitud debe estar entre -90 y 90.'
        using errcode = '22023', hint = 'ubicacion';
    end if;
    if new.longitud < -180 or new.longitud > 180 then
      raise exception 'La longitud debe estar entre -180 y 180.'
        using errcode = '22023', hint = 'ubicacion';
    end if;
    new.latitud  := round(new.latitud::numeric, 3);
    new.longitud := round(new.longitud::numeric, 3);
  end if;

  -- Foto de perfil: solo URLs https
  if new.foto_url is not null and new.foto_url !~ '^https://' then
    raise exception 'La foto de perfil debe ser una URL https.'
      using errcode = '22023', hint = 'foto_url';
  end if;

  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists antes_guardar_perfil on public.usuarios;
create trigger antes_guardar_perfil
  before insert or update on public.usuarios
  for each row execute function public.validar_perfil_usuario();


-- ---------------------------------------------------------------------
-- 3. Datos del prestador (pantalla "Regístrate como prestador")
-- ---------------------------------------------------------------------
create table if not exists public.prestadores (
  usuario_id          uuid primary key references public.usuarios (id) on delete cascade,
  categoria           text not null,
  experiencia         text,
  herramientas_propias boolean not null default false,
  identificacion_path text,               -- ruta en el bucket privado "identificaciones"
  verificado          boolean not null default false, -- lo cambia un administrador
  creado_en           timestamptz not null default now()
);

alter table public.prestadores enable row level security;

drop policy if exists "Prestadores ven sus propios datos" on public.prestadores;
create policy "Prestadores ven sus propios datos"
on public.prestadores
for select
to authenticated
using ((select auth.uid()) = usuario_id);

drop policy if exists "Prestadores actualizan sus propios datos" on public.prestadores;
create policy "Prestadores actualizan sus propios datos"
on public.prestadores
for update
to authenticated
using ((select auth.uid()) = usuario_id)
with check ((select auth.uid()) = usuario_id);

drop policy if exists "Prestadores crean su registro" on public.prestadores;
create policy "Prestadores crean su registro"
on public.prestadores
for insert
to authenticated
with check ((select auth.uid()) = usuario_id);

-- "verificado" no lo puede cambiar el propio usuario
revoke update on public.prestadores from authenticated, anon;
grant update (categoria, experiencia, herramientas_propias, identificacion_path)
  on public.prestadores to authenticated;


-- ---------------------------------------------------------------------
-- 4. Perfil automático al registrarse (reemplaza la versión de 01)
--    Lee lo que manda la app en options.data (src/services/registro.ts):
--    nombre, tipo_usuario, telefono, colonia, categoria, experiencia,
--    herramientas_propias. "colonia" se queda en auth.users.raw_user_meta_data.
-- ---------------------------------------------------------------------
create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  datos    jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  tipo     text;
  telefono text;
  nombre   text;
begin
  nombre := left(coalesce(
    nullif(trim(datos ->> 'nombre'), ''),
    split_part(new.email, '@', 1)
  ), 80);
  if char_length(nombre) < 2 then
    nombre := 'Usuario';
  end if;

  tipo := case
    when datos ->> 'tipo_usuario' in ('CLIENTE', 'PRESTADOR') then datos ->> 'tipo_usuario'
    else 'CLIENTE'
  end;

  -- Un teléfono inválido no debe impedir el registro: se guarda vacío
  telefono := regexp_replace(coalesce(datos ->> 'telefono', ''), '[\s\-()]', '', 'g');
  if telefono !~ '^\+?[0-9]{10,15}$' then
    telefono := null;
  end if;

  insert into public.usuarios (id, email, nombre, tipo_usuario, telefono)
  values (
    new.id,
    new.email,
    nombre,
    tipo,
    telefono
  );

  if tipo = 'PRESTADOR' then
    insert into public.prestadores (usuario_id, categoria, experiencia, herramientas_propias)
    values (
      new.id,
      coalesce(nullif(trim(datos ->> 'categoria'), ''), 'Sin categoría'),
      nullif(trim(datos ->> 'experiencia'), ''),
      coalesce((datos ->> 'herramientas_propias')::boolean, false)
    );
  end if;

  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 5. Columnas que el usuario puede editar desde la app
--    (es_admin, estado_cuenta, email y actualizado_en quedan bloqueadas -> 403)
-- ---------------------------------------------------------------------
revoke update on public.usuarios from authenticated, anon;
grant update (nombre, tipo_usuario, fecha_nacimiento, latitud, longitud, telefono, foto_url)
  on public.usuarios to authenticated;


-- ---------------------------------------------------------------------
-- 6. Storage
--    Cada usuario solo escribe dentro de la carpeta con su id: <id>/archivo
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatares', 'avatares', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('identificaciones', 'identificaciones', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- avatares (público para leer; escribir solo en tu carpeta)
drop policy if exists "Avatares: ver los propios" on storage.objects;
create policy "Avatares: ver los propios"
on storage.objects for select to authenticated
using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Avatares: subir a mi carpeta" on storage.objects;
create policy "Avatares: subir a mi carpeta"
on storage.objects for insert to authenticated
with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Avatares: reemplazar en mi carpeta" on storage.objects;
create policy "Avatares: reemplazar en mi carpeta"
on storage.objects for update to authenticated
using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Avatares: borrar en mi carpeta" on storage.objects;
create policy "Avatares: borrar en mi carpeta"
on storage.objects for delete to authenticated
using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- identificaciones (privado: solo el dueño la ve)
drop policy if exists "Identificaciones: ver la propia" on storage.objects;
create policy "Identificaciones: ver la propia"
on storage.objects for select to authenticated
using (bucket_id = 'identificaciones' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Identificaciones: subir a mi carpeta" on storage.objects;
create policy "Identificaciones: subir a mi carpeta"
on storage.objects for insert to authenticated
with check (bucket_id = 'identificaciones' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Identificaciones: reemplazar en mi carpeta" on storage.objects;
create policy "Identificaciones: reemplazar en mi carpeta"
on storage.objects for update to authenticated
using (bucket_id = 'identificaciones' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'identificaciones' and (storage.foldername(name))[1] = (select auth.uid())::text);
