// src/server/galeria.ts — Sprint 5 · Actualizar la galería de una publicación (solo servidor)
//
// Flujo de PUT /api/publications/:id/images:
//   1. Cadena de validación (Chain of Responsibility): forma de la lista (1 a 8, sin repetidas).
//   2. La BD sincroniza la tabla imagenes_publicacion en UNA transacción
//      (función actualizar_imagenes_publicacion de supabase/04_sprint5_galeria.sql).
//      Ahí se revisa que cada foto NUEVA esté en la carpeta del usuario y exista en el bucket.
//      Las fotos que ya tenía la publicación se aceptan tal como están guardadas
//      (aunque se hayan subido con otro formato de nombre en sprints anteriores).
//   3. Se borran del bucket "publicaciones" los archivos que ya no usa la publicación.
//
// Si el paso 3 falla, la publicación ya quedó bien; el archivo solo queda huérfano
// (se puede revisar con la vista public.fotos_huerfanas).

import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import {
  BUCKET_PUBLICACIONES,
  REGLAS,
  type CodigoError,
  type NuevaPublicacion,
  type Publicacion,
} from '@/lib/publicaciones/tipos';
import {
  Validador,
  construirCadena,
  ejecutarCadena,
  type ContextoValidacion,
} from '@/lib/publicaciones/validadores';
import { aPublicacion, traducirErrorBD } from '@/server/publicaciones';
import { urlBaseBucket } from '@/server/supabase';

/** De 1 a 8 fotos, cada una con texto y sin repetidas. */
class ValidadorListaGaleria extends Validador {
  protected validar(ctx: ContextoValidacion) {
    const { imagenes } = ctx.datos;
    if (imagenes.length < REGLAS.IMAGENES_MIN) {
      this.error(ctx, 'imagenes', 'La publicación debe tener al menos una fotografía.');
    } else if (imagenes.length > REGLAS.IMAGENES_MAX) {
      this.error(ctx, 'imagenes', `Puedes tener máximo ${REGLAS.IMAGENES_MAX} fotografías.`);
    } else if (imagenes.some((ruta) => !ruta || ruta.length > 1000)) {
      this.error(ctx, 'imagenes', 'Alguna fotografía no tiene una ruta válida.');
    } else if (new Set(imagenes).size !== imagenes.length) {
      this.error(ctx, 'imagenes', 'Hay fotografías repetidas.');
    }
  }
}

/** Convierte el cuerpo recibido en la lista de rutas (o null si no tiene la forma correcta). */
export function normalizarCambioGaleria(cuerpo: unknown): string[] | null {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return null;
  const { imagenes } = cuerpo as Record<string, unknown>;
  if (!Array.isArray(imagenes)) return null;
  return imagenes.map((i) => (typeof i === 'string' ? i.trim() : ''));
}

export async function validarGaleria(imagenes: string[]) {
  // La cadena trabaja sobre NuevaPublicacion; aquí solo importan las imágenes
  const datos: NuevaPublicacion = { titulo: '', descripcion: '', precio: 0, categoria_id: 0, imagenes };
  return ejecutarCadena(construirCadena(new ValidadorListaGaleria()), datos);
}

export type ErrorGaleria = {
  estado: number;
  codigo: CodigoError;
  mensaje: string;
  campo?: 'imagenes';
};

function traducirError(error: PostgrestError): ErrorGaleria {
  if (error.code === 'P0002') {
    return { estado: 404, codigo: 'NO_ENCONTRADO', mensaje: error.message };
  }
  const t = traducirErrorBD(error);
  return { ...t, campo: t.campo === 'imagenes' ? 'imagenes' : undefined };
}

type RespuestaBD = { publicacion: Parameters<typeof aPublicacion>[0]; descartadas: string[] };

export async function actualizarGaleria(
  supabase: SupabaseClient,
  idPublicacion: string,
  imagenes: string[]
): Promise<
  | { publicacion: Publicacion; eliminadas: number; error: null }
  | { publicacion: null; eliminadas: 0; error: ErrorGaleria }
> {
  const { data, error } = await supabase.rpc('actualizar_imagenes_publicacion', {
    p_id: idPublicacion,
    rutas: imagenes,
    url_base: urlBaseBucket(BUCKET_PUBLICACIONES),
  });
  if (error) return { publicacion: null, eliminadas: 0, error: traducirError(error) };

  const respuesta = data as RespuestaBD;
  let eliminadas = 0;

  // Borrar del bucket los archivos descartados (con el token del usuario: solo puede borrar los suyos)
  if (respuesta.descartadas.length > 0) {
    const { data: borrados, error: errorStorage } = await supabase.storage
      .from(BUCKET_PUBLICACIONES)
      .remove(respuesta.descartadas);
    if (errorStorage) {
      console.warn('[api] no se pudieron borrar fotos descartadas:', errorStorage.message);
    } else {
      eliminadas = borrados?.length ?? 0;
    }
  }

  return { publicacion: aPublicacion(respuesta.publicacion), eliminadas, error: null };
}