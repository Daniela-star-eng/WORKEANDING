-- =====================================================================
-- 04 · Sprint 5 · Actualizar galería de fotografías al editar
-- Ejecutar UNA vez en Supabase > SQL Editor, DESPUÉS de 03_sprint4_publicaciones.sql
-- Se puede ejecutar más de una vez sin problema.
--
-- Qué agrega:
--   actualizar_imagenes_publicacion(p_id, rutas, url_base)
--     Recibe la lista FINAL de fotos de la publicación (en orden; la primera es la portada)
--     y en una sola transacción:
--       · conserva las fotos que siguen en la lista,
--       · agrega las nuevas (ya subidas al bucket, en la carpeta del usuario),
--       · quita de la tabla las que ya no vienen,
--       · reordena todo (1 = portada).
--     Regresa la publicación actualizada y las rutas descartadas para que la API
--     borre esos archivos del bucket "publicaciones".
--
-- Reemplazar una foto = quitar su ruta de la lista y poner la nueva en la misma posición.
--
-- Errores (mismo formato que el Sprint 4):
--   22023 + HINT 'imagenes'     -> 400 (lista inválida, foto no subida, repetida...)
--   42501                       -> 403 (sin sesión o no es el dueño)
--   P0002 + HINT 'publicacion'  -> 404 (no existe o no es tuya)
-- =====================================================================

drop function if exists public.actualizar_imagenes_publicacion(uuid, jsonb, text);

create or replace function public.actualizar_imagenes_publicacion(
  p_id     uuid,
  rutas    jsonb,
  url_base text
)
returns jsonb
language plpgsql
security invoker            -- corre como el usuario: RLS y permisos aplican
set search_path = ''
as $$
declare
  uid         uuid := auth.uid();
  dueno       uuid;
  ruta        text;
  url_foto    text;
  existentes  jsonb;        -- { "<ruta>": "<url>" } de las fotos que ya tiene
  finales     text[] := '{}';
  urls        text[] := '{}';
  descartadas text[];
begin
  if uid is null then
    raise exception 'Debes iniciar sesión.' using errcode = '42501', hint = 'sesion';
  end if;
  if url_base is null or url_base !~ '^https?://.+/storage/v1/object/public/publicaciones/$' then
    raise exception 'url_base no es la URL pública del bucket publicaciones.'
      using errcode = '22023', hint = 'imagenes';
  end if;

  -- Lista: arreglo de 1 a 8 rutas
  if jsonb_typeof(rutas) is distinct from 'array' then
    raise exception 'Envía las fotografías como una lista.' using errcode = '22023', hint = 'imagenes';
  end if;
  if jsonb_array_length(rutas) < 1 then
    raise exception 'La publicación debe tener al menos una fotografía.' using errcode = '22023', hint = 'imagenes';
  end if;
  if jsonb_array_length(rutas) > 8 then
    raise exception 'Puedes tener máximo 8 fotografías.' using errcode = '22023', hint = 'imagenes';
  end if;

  -- La publicación existe y es del usuario. FOR UPDATE bloquea la fila para que
  -- dos ediciones al mismo tiempo no mezclen sus fotos.
  select p.usuario_id into dueno
  from public.publicaciones p
  where p.id = p_id
  for update;

  if dueno is null then
    raise exception 'La publicación no existe o no es tuya.' using errcode = 'P0002', hint = 'publicacion';
  end if;
  if dueno <> uid then
    raise exception 'Solo el autor puede cambiar las fotografías.' using errcode = '42501', hint = 'rol';
  end if;

  -- Fotos actuales. Las de antes del Sprint 4 pueden no tener "ruta": se saca de la url.
  select coalesce(jsonb_object_agg(coalesce(i.ruta, replace(i.url, url_base, '')), i.url), '{}'::jsonb)
  into existentes
  from public.imagenes_publicacion i
  where i.publicacion_id = p_id;

  -- Revisar cada ruta de la lista final
  for ruta in select jsonb_array_elements_text(rutas) loop
    if ruta = any (finales) then
      raise exception 'Hay fotografías repetidas.' using errcode = '22023', hint = 'imagenes';
    end if;

    if existentes ? ruta then
      url_foto := existentes ->> ruta;                    -- se conserva
    else
      -- Nueva: en la carpeta del usuario y ya subida al bucket
      if ruta !~ ('^' || uid::text || '/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$') then
        raise exception 'Cada fotografía nueva debe estar en tu carpeta del bucket publicaciones.'
          using errcode = '22023', hint = 'imagenes';
      end if;
      if not exists (
        select 1 from storage.objects o where o.bucket_id = 'publicaciones' and o.name = ruta
      ) then
        raise exception 'No se encontró la fotografía %. Súbela antes de guardar.', ruta
          using errcode = '22023', hint = 'imagenes';
      end if;
      url_foto := url_base || ruta;
    end if;

    finales := finales || ruta;
    urls    := urls || url_foto;
  end loop;

  -- Las que ya no vienen en la lista
  select coalesce(array_agg(k), '{}') into descartadas
  from jsonb_object_keys(existentes) as k
  where not (k = any (finales));

  -- Se reescribe la galería completa en el nuevo orden (evita choques de "orden")
  delete from public.imagenes_publicacion where publicacion_id = p_id;

  insert into public.imagenes_publicacion (publicacion_id, url, ruta, orden)
  select p_id, f.url, f.ruta, f.orden::integer
  from unnest(finales, urls) with ordinality as f(ruta, url, orden);

  -- Marca la publicación como editada (el trigger actualiza actualizado_en).
  -- Se asigna titulo = titulo porque es una columna que el usuario sí puede actualizar.
  update public.publicaciones set titulo = titulo where id = p_id;

  return jsonb_build_object(
    'publicacion', public.publicacion_json(p_id),
    -- Solo se regresan archivos de la carpeta del usuario: son los únicos que puede borrar
    'descartadas', (
      select coalesce(jsonb_agg(d), '[]'::jsonb)
      from unnest(descartadas) d
      where split_part(d, '/', 1) = uid::text
    )
  );
end;
$$;

revoke execute on function public.actualizar_imagenes_publicacion(uuid, jsonb, text) from public, anon;
grant execute on function public.actualizar_imagenes_publicacion(uuid, jsonb, text) to authenticated;

-- Permisos que usa la función (ya existen desde el 03; se repiten por si acaso)
grant insert (publicacion_id, url, ruta, orden) on public.imagenes_publicacion to authenticated;
grant delete on public.imagenes_publicacion to authenticated;


-- ---------------------------------------------------------------------
-- Consulta de apoyo: fotos subidas que ninguna publicación usa (huérfanas)
-- Útil para revisar que la sincronización no deja basura en el bucket.
--   select * from public.fotos_huerfanas;
-- ---------------------------------------------------------------------
create or replace view public.fotos_huerfanas
with (security_invoker = true) as
select o.name as ruta, o.created_at
from storage.objects o
where o.bucket_id = 'publicaciones'
  and not exists (
    select 1 from public.imagenes_publicacion i
    where i.ruta = o.name
  );

revoke all on public.fotos_huerfanas from anon;
grant select on public.fotos_huerfanas to authenticated;