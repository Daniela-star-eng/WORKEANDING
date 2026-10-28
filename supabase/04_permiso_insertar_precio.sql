-- Complementa el GRANT de inserción ya aplicado en el proyecto.
-- No modifica filas, columnas ni políticas RLS. Solo añade permiso INSERT de precio.
grant insert (precio) on table public.publicaciones to authenticated;
