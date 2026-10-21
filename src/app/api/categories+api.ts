// GET /api/categories — Catálogo de categorías (Sprint 4)
//   ?tipo=PRODUCTO | SERVICIO   (opcional) filtra por tipo
// No requiere sesión.

import { TIPOS_PUBLICACION, type TipoPublicacion } from '@/lib/publicaciones/tipos';
import { errorJson, json, manejarErrorInterno } from '@/server/http';
import { listarCategorias } from '@/server/publicaciones';
import { clienteSupabase } from '@/server/supabase';

export async function GET(request: Request) {
  try {
    const tipo = new URL(request.url).searchParams.get('tipo')?.toUpperCase();
    if (tipo && !TIPOS_PUBLICACION.includes(tipo as TipoPublicacion)) {
      return errorJson(400, 'VALIDACION', 'El parámetro tipo debe ser PRODUCTO o SERVICIO.');
    }

    const { categorias, error } = await listarCategorias(
      clienteSupabase(),
      tipo as TipoPublicacion | undefined
    );
    if (error) return errorJson(error.estado, error.codigo, error.mensaje);

    // Las categorías casi no cambian: se pueden guardar en caché 5 minutos
    return json({ data: categorias }, 200, { 'Cache-Control': 'public, max-age=300' });
  } catch (e) {
    return manejarErrorInterno(e);
  }
}