-- VERSIÓN CORREGIDA: NO ES NECESARIO EJECUTAR UNA MIGRACIÓN.
-- Se reutilizan public.publicaciones, public.imagenes_publicacion y el bucket publicaciones.
-- El contenido anterior de este archivo quedó obsoleto. NO ejecutar copias antiguas.
-- Consulta opcional de comprobación; no modifica tablas, registros, permisos ni buckets.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'publicaciones';
