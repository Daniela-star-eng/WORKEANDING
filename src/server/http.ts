// src/server/http.ts — Respuestas JSON y autenticación para las rutas de API
// (La app, la versión web y Swagger en /api/docs comparten origen: no se necesita CORS.)

import type { User } from '@supabase/supabase-js';

import type { CodigoError, ErroresPublicacion, RespuestaError } from '@/lib/publicaciones/tipos';
import { clienteSupabase } from '@/server/supabase';

export function json(cuerpo: unknown, estado = 200, encabezados: Record<string, string> = {}) {
  return Response.json(cuerpo, { status: estado, headers: encabezados });
}

export function errorJson(
  estado: number,
  codigo: CodigoError,
  mensaje: string,
  campos?: ErroresPublicacion
) {
  const cuerpo: RespuestaError = { error: { codigo, mensaje, ...(campos ? { campos } : {}) } };
  return json(cuerpo, estado);
}

export function tokenDe(request: Request): string | null {
  const encabezado = request.headers.get('authorization') ?? '';
  const [tipo, token] = encabezado.split(' ');
  return tipo?.toLowerCase() === 'bearer' && token ? token : null;
}

/**
 * Verifica el token con Supabase Auth.
 * Regresa el usuario o una respuesta 401 lista para devolver.
 */
export async function autenticar(
  request: Request
): Promise<{ token: string; usuario: User } | { respuesta: Response }> {
  const token = tokenDe(request);
  if (!token) {
    return {
      respuesta: errorJson(401, 'NO_AUTENTICADO', 'Inicia sesión: falta el encabezado Authorization: Bearer <token>.'),
    };
  }
  const { data, error } = await clienteSupabase(token).auth.getUser(token);
  if (error || !data.user) {
    return { respuesta: errorJson(401, 'NO_AUTENTICADO', 'Tu sesión no es válida o expiró. Vuelve a iniciar sesión.') };
  }
  return { token, usuario: data.user };
}

/** Lee el cuerpo JSON sin tronar si viene vacío o mal formado */
export async function leerJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/** Atrapa errores inesperados para no exponer detalles internos */
export function manejarErrorInterno(error: unknown) {
  console.error('[api] error inesperado:', error);
  return errorJson(500, 'ERROR_INTERNO', 'Ocurrió un error inesperado. Inténtalo de nuevo.');
}