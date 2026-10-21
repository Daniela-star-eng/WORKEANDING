// GET /api/publications/:id — Detalle de una publicación
// Requiere sesión. Los clientes ven las APROBADAS; el prestador también ve las suyas PENDIENTES.

import { autenticar, errorJson, json, manejarErrorInterno } from '@/server/http';
import { obtenerPublicacion } from '@/server/publicaciones';
import { clienteSupabase } from '@/server/supabase';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { id }: Record<string, string>) {
  try {
    if (!UUID.test(id)) return errorJson(400, 'VALIDACION', 'El id de la publicación no es válido.');

    const auth = await autenticar(request);
    if ('respuesta' in auth) return auth.respuesta;

    const { publicacion, error } = await obtenerPublicacion(clienteSupabase(auth.token), id);
    if (error) return errorJson(error.estado, error.codigo, error.mensaje);
    if (!publicacion) return errorJson(404, 'NO_ENCONTRADO', 'La publicación no existe o no está disponible.');

    return json({ data: publicacion });
  } catch (e) {
    return manejarErrorInterno(e);
  }
}