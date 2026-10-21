-- =====================================================================
-- 03 · Sprint 4 · Publicación de productos y servicios (PB-04 / PB-05)
-- Ejecutar UNA vez en Supabase > SQL Editor, DESPUÉS de 02_sprint3_perfil.sql
--
-- Trabaja SOBRE las tablas que ya existen en la base del equipo
-- (categorias, publicaciones, imagenes_publicacion, registros_moderacion):
-- solo agrega columnas, reglas y permisos. No borra ni renombra nada.
-- Se puede ejecutar más de una vez sin problema.
--
-- Qué agrega:
--   categorias            slug, icono, orden, activa + catálogo inicial
--   publicaciones         descripcion, tipo, latitud, longitud, creado_en, actualizado_en
--   imagenes_publicacion  ruta (archivo en Storage)
--   terminos_restringidos palabras que mandan una publicación a revisión
--   validar_publicacion   trigger con todas las reglas (la BD es la que manda)
--   crear_publicacion     publicación + fotos en una sola transacción
--   RLS                   políticas que faltaban (insertar, ver las propias, categorías, imágenes)
--   Storage               bucket "publicaciones"
--
-- Moderación (Problema 4) con los valores que ya usa la tabla:
--   estado_moderacion = 'APROBADA'   texto limpio: visible para los clientes
--                     = 'PENDIENTE'  menciona algo restringido: espera revisión
--                     = 'RECHAZADA'  lo decide un administrador
--   Cada decisión automática queda en registros_moderacion.
--
-- Errores: código 22023 + HINT con el campo (la API responde 400);
-- 42501 sin permiso (403); HINT 'limite' al pasar de 20 publicaciones (409).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. Utilidades
-- ---------------------------------------------------------------------
-- Minúsculas y sin acentos (sin depender de la extensión unaccent)
create or replace function public.normalizar_texto(texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(lower(coalesce(texto, '')), 'áéíóúüñ', 'aeiouun');
$$;


-- ---------------------------------------------------------------------
-- 1. Categorías
-- ---------------------------------------------------------------------
alter table public.categorias
  add column if not exists slug   text,
  add column if not exists icono  text,                       -- nombre de ícono de Ionicons
  add column if not exists orden  smallint not null default 0,
  add column if not exists activa boolean  not null default true;

-- tipo en mayúsculas: PRODUCTO o SERVICIO
update public.categorias set tipo = upper(trim(tipo)) where tipo is not null and tipo <> upper(trim(tipo));

-- Catálogo inicial (solo agrega las que no existan con ese nombre)
insert into public.categorias (nombre, tipo, icono, orden, solo_mayores)
select v.nombre, v.tipo, v.icono, v.orden, false
from (values
  -- Productos
  ('Herramientas y maquinaria',   'PRODUCTO', 'hammer-outline',         1),
  ('Electrónica y tecnología',    'PRODUCTO', 'laptop-outline',         2),
  ('Vehículos y bicicletas',      'PRODUCTO', 'bicycle-outline',        3),
  ('Hogar y muebles',             'PRODUCTO', 'bed-outline',            4),
  ('Deportes y aire libre',       'PRODUCTO', 'football-outline',       5),
  ('Mobiliario para eventos',     'PRODUCTO', 'balloon-outline',        6),
  ('Ropa y disfraces',            'PRODUCTO', 'shirt-outline',          7),
  ('Cámaras y fotografía',        'PRODUCTO', 'camera-outline',         8),
  ('Instrumentos musicales',      'PRODUCTO', 'musical-notes-outline',  9),
  ('Camping',                     'PRODUCTO', 'bonfire-outline',       10),
  -- Servicios (incluye las del registro de prestador)
  ('Plomería, Grifería y Gas',    'SERVICIO', 'water-outline',         11),
  ('Electricidad',                'SERVICIO', 'flash-outline',         12),
  ('Carpintería',                 'SERVICIO', 'construct-outline',     13),
  ('Pintura',                     'SERVICIO', 'color-palette-outline', 14),
  ('Albañilería',                 'SERVICIO', 'business-outline',      15),
  ('Cerrajería',                  'SERVICIO', 'key-outline',           16),
  ('Aire acondicionado',          'SERVICIO', 'snow-outline',          17),
  ('Limpieza',                    'SERVICIO', 'sparkles-outline',      18),
  ('Jardinería',                  'SERVICIO', 'leaf-outline',          19),
  ('Mudanzas y fletes',           'SERVICIO', 'car-outline',           20),
  ('Clases y tutorías',           'SERVICIO', 'school-outline',        21),
  ('Eventos y entretenimiento',   'SERVICIO', 'mic-outline',           22)
) as v(nombre, tipo, icono, orden)
where not exists (
  select 1 from public.categorias c where public.normalizar_texto(c.nombre) = public.normalizar_texto(v.nombre)
);

-- slug a partir del nombre ("Plomería, Grifería y Gas" -> "plomeria-griferia-y-gas")
update public.categorias
set slug = trim(both '-' from regexp_replace(public.normalizar_texto(nombre), '[^a-z0-9]+', '-', 'g'))
where slug is null or slug = '';

-- Si dos categorías quedaron con el mismo slug, a la más nueva se le agrega su id
update public.categorias c
set slug = c.slug || '-' || c.id
where exists (select 1 from public.categorias o where o.slug = c.slug and o.id < c.id);

create unique index if not exists categorias_slug_key on public.categorias (slug);


-- ---------------------------------------------------------------------
-- 2. Publicaciones: columnas que faltan
-- ---------------------------------------------------------------------
alter table public.publicaciones
  add column if not exists descripcion    text,
  add column if not exists tipo           text,             -- PRODUCTO | SERVICIO (de la categoría)
  add column if not exists latitud        numeric(6, 3),    -- ubicación aproximada (~100 m)
  add column if not exists longitud       numeric(7, 3),
  add column if not exists creado_en      timestamptz not null default now(),
  add column if not exists actualizado_en timestamptz not null default now();

alter table public.publicaciones alter column disponibilidad    set default 'DISPONIBLE';
alter table public.publicaciones alter column unidad_precio     set default 'DIA';
alter table public.publicaciones alter column estado_moderacion set default 'PENDIENTE';

create index if not exists publicaciones_usuario_idx on public.publicaciones (usuario_id);
create index if not exists publicaciones_listado_idx
  on public.publicaciones (estado_moderacion, disponibilidad, categoria_id, creado_en desc);


-- ---------------------------------------------------------------------
-- 3. Imágenes: ruta del archivo en Storage (url ya existe)
-- ---------------------------------------------------------------------
alter table public.imagenes_publicacion add column if not exists ruta text;
create index if not exists imagenes_publicacion_pub_idx on public.imagenes_publicacion (publicacion_id, orden);


-- ---------------------------------------------------------------------
-- 4. Moderación automática: términos restringidos
--    (la API tiene la misma lista en src/lib/publicaciones/validadores.ts)
-- ---------------------------------------------------------------------
create table if not exists public.terminos_restringidos (
  termino text primary key   -- en minúsculas y sin acentos
);

insert into public.terminos_restringidos (termino) values
  ('arma'), ('armas'), ('pistola'), ('rifle'), ('escopeta'), ('municion'), ('municiones'),
  ('droga'), ('drogas'), ('marihuana'), ('cocaina'), ('cristal'),
  ('explosivo'), ('explosivos'), ('pirotecnia'), ('cohetes'),
  ('medicamento controlado'), ('receta medica'),
  ('documento falso'), ('identificacion falsa'), ('placas falsas')
on conflict do nothing;

create or replace function public.termino_restringido_en(texto text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select t.termino
  from public.terminos_restringidos t
  where public.normalizar_texto(texto) ~ ('\m' || t.termino || '\M')
  limit 1;
$$;


-- ---------------------------------------------------------------------
-- 5. Validación y normalización de cada publicación (BEFORE INSERT/UPDATE)
-- ---------------------------------------------------------------------
create or replace function public.validar_publicacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cat    public.categorias;
  autor  public.usuarios;
  total  integer;
  limite constant integer := 20;
begin
  -- El autor, la fecha de creación y "destacada" no se cambian desde la app
  if tg_op = 'UPDATE' then
    new.usuario_id := old.usuario_id;
    new.creado_en  := old.creado_en;
  end if;

  -- Solo prestadores activos publican
  select * into autor from public.usuarios where id = new.usuario_id;
  if autor.id is null or upper(coalesce(autor.tipo_usuario, '')) <> 'PRESTADOR' then
    raise exception 'Solo los prestadores pueden publicar. Cambia tu tipo de cuenta en tu perfil.'
      using errcode = '42501', hint = 'rol';
  end if;
  if coalesce(autor.estado_cuenta, 'ACTIVA') <> 'ACTIVA' then
    raise exception 'Tu cuenta no está activa.' using errcode = '42501', hint = 'rol';
  end if;

  -- Título
  new.titulo := regexp_replace(trim(coalesce(new.titulo, '')), '\s+', ' ', 'g');
  if char_length(new.titulo) < 5 then
    raise exception 'El título debe tener al menos 5 caracteres.' using errcode = '22023', hint = 'titulo';
  end if;
  if char_length(new.titulo) > 100 then
    raise exception 'El título no puede tener más de 100 caracteres.' using errcode = '22023', hint = 'titulo';
  end if;

  -- Descripción
  new.descripcion := trim(coalesce(new.descripcion, ''));
  if char_length(new.descripcion) < 20 then
    raise exception 'La descripción debe tener al menos 20 caracteres.' using errcode = '22023', hint = 'descripcion';
  end if;
  if char_length(new.descripcion) > 2000 then
    raise exception 'La descripción no puede tener más de 2000 caracteres.' using errcode = '22023', hint = 'descripcion';
  end if;

  -- Precio
  if new.precio is null or new.precio <= 0 then
    raise exception 'El precio debe ser mayor a 0.' using errcode = '22023', hint = 'precio';
  end if;
  if new.precio > 999999.99 then
    raise exception 'El precio no puede ser mayor a 999,999.99.' using errcode = '22023', hint = 'precio';
  end if;

  new.unidad_precio := upper(coalesce(new.unidad_precio, 'DIA'));
  if new.unidad_precio not in ('HORA', 'DIA', 'SEMANA', 'MES', 'EVENTO', 'SERVICIO') then
    raise exception 'La unidad de precio debe ser HORA, DIA, SEMANA, MES, EVENTO o SERVICIO.'
      using errcode = '22023', hint = 'unidad_precio';
  end if;

  -- Disponibilidad (Sprint 6)
  new.disponibilidad := upper(coalesce(new.disponibilidad, 'DISPONIBLE'));
  if new.disponibilidad not in ('DISPONIBLE', 'NO_DISPONIBLE', 'EN_RENTA') then
    raise exception 'La disponibilidad debe ser DISPONIBLE, NO_DISPONIBLE o EN_RENTA.'
      using errcode = '22023', hint = 'disponibilidad';
  end if;

  -- Categoría (define si es PRODUCTO o SERVICIO)
  select * into cat from public.categorias where id = new.categoria_id;
  if cat.id is null or not cat.activa then
    raise exception 'La categoría no existe o no está disponible.' using errcode = '22023', hint = 'categoria_id';
  end if;
  if cat.tipo is null or cat.tipo not in ('PRODUCTO', 'SERVICIO') then
    raise exception 'La categoría no tiene tipo (PRODUCTO o SERVICIO). Pide a un administrador que la corrija.'
      using errcode = '22023', hint = 'categoria_id';
  end if;
  new.tipo := cat.tipo;

  -- Ubicación aproximada: juntas, en rango, 3 decimales; si falta, la del perfil
  if (new.latitud is null) <> (new.longitud is null) then
    raise exception 'La ubicación debe incluir latitud y longitud.' using errcode = '22023', hint = 'ubicacion';
  end if;
  if new.latitud is null and tg_op = 'INSERT' then
    new.latitud  := autor.latitud;
    new.longitud := autor.longitud;
  end if;
  if new.latitud is not null then
    if new.latitud < -90 or new.latitud > 90 or new.longitud < -180 or new.longitud > 180 then
      raise exception 'La ubicación no es válida.' using errcode = '22023', hint = 'ubicacion';
    end if;
    new.latitud  := round(new.latitud, 3);
    new.longitud := round(new.longitud, 3);
  end if;

  if tg_op = 'INSERT' then
    -- Límite de publicaciones por prestador (Problema 7)
    select count(*) into total
    from public.publicaciones
    where usuario_id = new.usuario_id and coalesce(estado_moderacion, '') <> 'RECHAZADA';
    if total >= limite then
      raise exception 'Alcanzaste el máximo de % publicaciones activas.', limite
        using errcode = '22023', hint = 'limite';
    end if;

    new.disponibilidad := 'DISPONIBLE';
    new.destacada := false;   -- se activa en el Sprint 11 (publicidad)
    new.estado_moderacion := case
      when public.termino_restringido_en(new.titulo || ' ' || new.descripcion) is null then 'APROBADA'
      else 'PENDIENTE'
    end;
  else
    -- Al editar el texto se vuelve a moderar (Sprint 5)
    if (new.titulo is distinct from old.titulo or new.descripcion is distinct from old.descripcion)
       and public.termino_restringido_en(new.titulo || ' ' || new.descripcion) is not null then
      new.estado_moderacion := 'PENDIENTE';
    end if;
  end if;

  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists antes_guardar_publicacion on public.publicaciones;
create trigger antes_guardar_publicacion
  before insert or update on public.publicaciones
  for each row execute function public.validar_publicacion();


-- Registro de la moderación automática (AFTER INSERT/UPDATE)
create or replace function public.registrar_moderacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  termino text := public.termino_restringido_en(new.titulo || ' ' || new.descripcion);
begin
  if tg_op = 'INSERT'
     or new.estado_moderacion is distinct from old.estado_moderacion
     or new.titulo is distinct from old.titulo
     or new.descripcion is distinct from old.descripcion then
    insert into public.registros_moderacion (publicacion_id, detector, resultado)
    values (
      new.id,
      'terminos_restringidos',
      case when termino is null then 'APROBADA'
           else 'PENDIENTE: menciona "' || termino || '"' end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists despues_guardar_publicacion on public.publicaciones;
create trigger despues_guardar_publicacion
  after insert or update on public.publicaciones
  for each row execute function public.registrar_moderacion();


-- ---------------------------------------------------------------------
-- 6. Publicación como JSON (lo que regresa la API)
-- ---------------------------------------------------------------------
create or replace function public.publicacion_json(p_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'usuario_id', p.usuario_id,
    'tipo', p.tipo,
    'titulo', p.titulo,
    'descripcion', p.descripcion,
    'precio', p.precio,
    'unidad_precio', p.unidad_precio,
    'latitud', p.latitud,
    'longitud', p.longitud,
    'disponibilidad', p.disponibilidad,
    'estado_moderacion', p.estado_moderacion,
    'destacada', p.destacada,
    'creado_en', p.creado_en,
    'actualizado_en', p.actualizado_en,
    'categoria', jsonb_build_object('id', c.id, 'nombre', c.nombre, 'slug', c.slug, 'tipo', c.tipo),
    'imagenes', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'url', i.url, 'ruta', i.ruta, 'orden', i.orden)
                       order by i.orden)
      from public.imagenes_publicacion i
      where i.publicacion_id = p.id
    ), '[]'::jsonb)
  )
  from public.publicaciones p
  join public.categorias c on c.id = p.categoria_id
  where p.id = p_id;
$$;


-- ---------------------------------------------------------------------
-- 7. Crear publicación + imágenes en una sola transacción
--    La usa POST /api/publications. Corre con los permisos del usuario (RLS aplica).
--    url_base: URL pública del bucket, p. ej.
--    https://TU-PROYECTO.supabase.co/storage/v1/object/public/publicaciones/
-- ---------------------------------------------------------------------
drop function if exists public.crear_publicacion(jsonb);
create or replace function public.crear_publicacion(datos jsonb, url_base text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid    uuid := auth.uid();
  nueva  uuid;
  imgs   jsonb := coalesce(datos -> 'imagenes', '[]'::jsonb);
  ruta   text;
  orden  integer := 1;
  rutas  text[] := '{}';
begin
  if uid is null then
    raise exception 'Debes iniciar sesión para publicar.' using errcode = '42501', hint = 'sesion';
  end if;
  if jsonb_typeof(datos) is distinct from 'object' then
    raise exception 'El cuerpo debe ser un objeto JSON.' using errcode = '22023', hint = 'cuerpo';
  end if;
  if url_base is null or url_base !~ '^https?://.+/storage/v1/object/public/publicaciones/$' then
    raise exception 'url_base no es la URL pública del bucket publicaciones.' using errcode = '22023', hint = 'imagenes';
  end if;

  -- Tipos de dato antes de convertir
  if jsonb_typeof(datos -> 'categoria_id') is distinct from 'number' then
    raise exception 'Selecciona una categoría.' using errcode = '22023', hint = 'categoria_id';
  end if;
  if jsonb_typeof(datos -> 'precio') is distinct from 'number' then
    raise exception 'El precio debe ser un número.' using errcode = '22023', hint = 'precio';
  end if;
  if coalesce(jsonb_typeof(datos -> 'latitud'), 'null') not in ('number', 'null')
     or coalesce(jsonb_typeof(datos -> 'longitud'), 'null') not in ('number', 'null') then
    raise exception 'La ubicación debe ser numérica.' using errcode = '22023', hint = 'ubicacion';
  end if;

  -- Fotografías: 1 a 8
  if jsonb_typeof(imgs) <> 'array' or jsonb_array_length(imgs) < 1 then
    raise exception 'Agrega al menos una fotografía.' using errcode = '22023', hint = 'imagenes';
  end if;
  if jsonb_array_length(imgs) > 8 then
    raise exception 'Puedes agregar máximo 8 fotografías.' using errcode = '22023', hint = 'imagenes';
  end if;

  insert into public.publicaciones
    (usuario_id, categoria_id, titulo, descripcion, precio, unidad_precio, latitud, longitud)
  values (
    uid,
    (datos ->> 'categoria_id')::bigint,
    datos ->> 'titulo',
    datos ->> 'descripcion',
    round((datos ->> 'precio')::numeric, 2),
    coalesce(datos ->> 'unidad_precio', 'DIA'),
    (datos ->> 'latitud')::numeric,
    (datos ->> 'longitud')::numeric
  )
  returning id into nueva;

  for ruta in select jsonb_array_elements_text(imgs) loop
    -- En la carpeta del usuario y ya subida al bucket
    if ruta !~ ('^' || uid::text || '/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$') then
      raise exception 'Cada fotografía debe estar en tu carpeta del bucket publicaciones.'
        using errcode = '22023', hint = 'imagenes';
    end if;
    if ruta = any (rutas) then
      raise exception 'Hay fotografías repetidas.' using errcode = '22023', hint = 'imagenes';
    end if;
    if not exists (
      select 1 from storage.objects o where o.bucket_id = 'publicaciones' and o.name = ruta
    ) then
      raise exception 'No se encontró la fotografía %. Súbela antes de publicar.', ruta
        using errcode = '22023', hint = 'imagenes';
    end if;

    insert into public.imagenes_publicacion (publicacion_id, url, ruta, orden)
    values (nueva, url_base || ruta, ruta, orden);
    rutas := rutas || ruta;
    orden := orden + 1;
  end loop;

  return public.publicacion_json(nueva);
end;
$$;


-- ---------------------------------------------------------------------
-- 8. Seguridad (RLS + permisos por columna)
-- ---------------------------------------------------------------------
alter table public.terminos_restringidos enable row level security;

-- Supabase da todos los permisos por defecto: se dejan solo los necesarios
revoke all on public.categorias, public.publicaciones, public.imagenes_publicacion,
              public.terminos_restringidos, public.registros_moderacion
  from anon, authenticated;

grant select on public.categorias to anon, authenticated;
grant select on public.publicaciones, public.imagenes_publicacion to authenticated;
grant insert (usuario_id, categoria_id, titulo, descripcion, precio, unidad_precio, latitud, longitud)
  on public.publicaciones to authenticated;
-- Edición (Sprint 5) y disponibilidad (Sprint 6). No se pueden tocar
-- estado_moderacion, destacada ni usuario_id.
grant update (categoria_id, titulo, descripcion, precio, unidad_precio, latitud, longitud, disponibilidad)
  on public.publicaciones to authenticated;
grant insert (publicacion_id, url, ruta, orden) on public.imagenes_publicacion to authenticated;
grant delete on public.imagenes_publicacion to authenticated;

revoke execute on function public.crear_publicacion(jsonb, text) from public, anon;
grant execute on function public.crear_publicacion(jsonb, text) to authenticated;
revoke execute on function public.termino_restringido_en(text) from public, anon, authenticated;

-- Categorías: todos ven las activas
drop policy if exists "Categorías activas visibles" on public.categorias;
create policy "Categorías activas visibles"
on public.categorias for select to anon, authenticated
using (activa);

-- Publicaciones
--   "Publicaciones visibles" (ya existía): los usuarios ven las APROBADAS.
--   Se agrega que el prestador vea todas las suyas y que pueda crearlas.
drop policy if exists "Usuarios ven sus publicaciones" on public.publicaciones;
create policy "Usuarios ven sus publicaciones"
on public.publicaciones for select to authenticated
using ((select auth.uid()) = usuario_id);

drop policy if exists "Prestadores crean sus publicaciones" on public.publicaciones;
create policy "Prestadores crean sus publicaciones"
on public.publicaciones for insert to authenticated
with check ((select auth.uid()) = usuario_id);

-- La política de actualización que ya existía no tenía WITH CHECK
drop policy if exists "Usuarios pueden actualizar sus publicaciones" on public.publicaciones;
create policy "Usuarios pueden actualizar sus publicaciones"
on public.publicaciones for update to authenticated
using ((select auth.uid()) = usuario_id)
with check ((select auth.uid()) = usuario_id);

-- Imágenes: visibles si la publicación es visible; solo el dueño agrega o borra
drop policy if exists "Imágenes visibles" on public.imagenes_publicacion;
create policy "Imágenes visibles"
on public.imagenes_publicacion for select to authenticated
using (exists (select 1 from public.publicaciones p where p.id = publicacion_id));

drop policy if exists "Prestador agrega imágenes" on public.imagenes_publicacion;
create policy "Prestador agrega imágenes"
on public.imagenes_publicacion for insert to authenticated
with check (
  exists (
    select 1 from public.publicaciones p
    where p.id = publicacion_id and p.usuario_id = (select auth.uid())
  )
  and split_part(ruta, '/', 1) = (select auth.uid())::text
);

drop policy if exists "Prestador borra imágenes" on public.imagenes_publicacion;
create policy "Prestador borra imágenes"
on public.imagenes_publicacion for delete to authenticated
using (
  exists (
    select 1 from public.publicaciones p
    where p.id = publicacion_id and p.usuario_id = (select auth.uid())
  )
);


-- ---------------------------------------------------------------------
-- 9. Storage: bucket público "publicaciones" (cada quien escribe en <su id>/)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('publicaciones', 'publicaciones', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Publicaciones: ver mis fotos" on storage.objects;
create policy "Publicaciones: ver mis fotos"
on storage.objects for select to authenticated
using (bucket_id = 'publicaciones' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Publicaciones: subir a mi carpeta" on storage.objects;
create policy "Publicaciones: subir a mi carpeta"
on storage.objects for insert to authenticated
with check (bucket_id = 'publicaciones' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Publicaciones: reemplazar en mi carpeta" on storage.objects;
create policy "Publicaciones: reemplazar en mi carpeta"
on storage.objects for update to authenticated
using (bucket_id = 'publicaciones' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'publicaciones' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Publicaciones: borrar en mi carpeta" on storage.objects;
create policy "Publicaciones: borrar en mi carpeta"
on storage.objects for delete to authenticated
using (bucket_id = 'publicaciones' and (storage.foldername(name))[1] = (select auth.uid())::text);