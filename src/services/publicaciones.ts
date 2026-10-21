// src/services/publicaciones.ts — Cliente de la API de publicaciones para las pantallas (Sprint 4)
//
// Uso típico en el formulario de "Nueva publicación":
//
//   const categorias = await obtenerCategorias('SERVICIO');
//   const { rutas, error } = await subirImagenesPublicacion(fotosElegidas); // de expo-image-picker
//   const r = await crearPublicacion({ titulo, descripcion, precio, unidad_precio, categoria_id, imagenes: rutas });
//   if (r.error) mostrar(r.error.campos?.titulo ...)
//
// Las peticiones van a las rutas de API del mismo proyecto (src/app/api).
// En desarrollo, Expo resuelve '/api/...' contra el servidor de `npx expo start`.

import { supabase } from '@/lib/supabase';
import {
  BUCKET_PUBLICACIONES,
  REGLAS,
  type Categoria,
  type NuevaPublicacion,
  type Publicacion,
  type RespuestaError,
  type TipoPublicacion,
} from '@/lib/publicaciones/tipos';

export type { Categoria, NuevaPublicacion, Publicacion } from '@/lib/publicaciones/tipos';
export { validarPublicacionLocal } from '@/lib/publicaciones/validadores';

export type ErrorApi = RespuestaError['error'];
type Resultado<T> = { data: T; error: null } | { data: null; error: ErrorApi };

const SIN_CONEXION: ErrorApi = {
  codigo: 'ERROR_INTERNO',
  mensaje: 'No hay conexión con el servidor. Revisa tu internet.',
};

async function encabezados(conSesion: boolean): Promise<Record<string, string>> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (conSesion) {
    const { data } = await supabase.auth.getSession();
    if (data.session) h.Authorization = `Bearer ${data.session.access_token}`;
  }
  return h;
}

async function pedir<T>(ruta: string, init: RequestInit = {}, conSesion = false): Promise<Resultado<T>> {
  try {
    const respuesta = await fetch(ruta, { ...init, headers: await encabezados(conSesion) });
    const cuerpo = await respuesta.json().catch(() => null);
    if (!respuesta.ok) {
      return { data: null, error: (cuerpo as RespuestaError | null)?.error ?? SIN_CONEXION };
    }
    return { data: cuerpo as T, error: null };
  } catch {
    return { data: null, error: SIN_CONEXION };
  }
}

// ---------- Categorías ----------

export async function obtenerCategorias(tipo?: TipoPublicacion): Promise<Resultado<Categoria[]>> {
  const r = await pedir<{ data: Categoria[] }>(`/api/categories${tipo ? `?tipo=${tipo}` : ''}`);
  return r.error ? r : { data: r.data.data, error: null };
}

// ---------- Fotos ----------

export type FotoElegida = { uri: string; mimeType?: string | null; fileSize?: number | null };

const TIPOS_FOTO: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Sube las fotos al bucket "publicaciones" en la carpeta del usuario y regresa sus rutas,
 * listas para mandarlas en `imagenes` de crearPublicacion().
 */
export async function subirImagenesPublicacion(
  fotos: FotoElegida[]
): Promise<{ rutas: string[]; error: string | null }> {
  if (fotos.length < REGLAS.IMAGENES_MIN) return { rutas: [], error: 'Agrega al menos una fotografía.' };
  if (fotos.length > REGLAS.IMAGENES_MAX) {
    return { rutas: [], error: `Puedes agregar máximo ${REGLAS.IMAGENES_MAX} fotografías.` };
  }

  const { data } = await supabase.auth.getSession();
  const idUsuario = data.session?.user.id;
  if (!idUsuario) return { rutas: [], error: 'Inicia sesión para subir fotografías.' };

  const rutas: string[] = [];
  for (const foto of fotos) {
    const tipo = foto.mimeType ?? 'image/jpeg';
    const extension = TIPOS_FOTO[tipo];
    if (!extension) return { rutas, error: 'Las fotografías deben ser JPG, PNG o WEBP.' };

    let contenido: ArrayBuffer;
    try {
      contenido = await (await fetch(foto.uri)).arrayBuffer();
    } catch {
      return { rutas, error: 'No se pudo leer una de las fotografías.' };
    }
    if (contenido.byteLength > REGLAS.IMAGEN_MAX_BYTES) {
      return { rutas, error: 'Cada fotografía puede pesar máximo 5 MB.' };
    }

    const nombre = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ruta = `${idUsuario}/${nombre}.${extension}`;
    const { error } = await supabase.storage
      .from(BUCKET_PUBLICACIONES)
      .upload(ruta, contenido, { contentType: tipo, upsert: false });
    if (error) {
      console.warn('Error al subir foto de publicación:', error.message);
      return { rutas, error: 'No se pudo subir una de las fotografías. Inténtalo de nuevo.' };
    }
    rutas.push(ruta);
  }
  return { rutas, error: null };
}

// ---------- Publicaciones ----------

export async function crearPublicacion(
  datos: NuevaPublicacion
): Promise<Resultado<{ publicacion: Publicacion; avisos: string[] }>> {
  const r = await pedir<{ data: Publicacion; avisos: string[] }>(
    '/api/publications',
    { method: 'POST', body: JSON.stringify(datos) },
    true
  );
  return r.error ? r : { data: { publicacion: r.data.data, avisos: r.data.avisos }, error: null };
}

export type FiltrosPublicaciones = {
  categoria_id?: number;
  tipo?: TipoPublicacion;
  mias?: boolean;
  limite?: number;
  pagina?: number;
};

export async function listarPublicaciones(filtros: FiltrosPublicaciones = {}) {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([clave, valor]) => {
    if (valor !== undefined) params.set(clave, String(valor));
  });
  const consulta = params.toString();
  return pedir<{
    data: Publicacion[];
    paginacion: { pagina: number; limite: number; total: number; paginas: number };
  }>(`/api/publications${consulta ? `?${consulta}` : ''}`, {}, true);
}

export async function obtenerPublicacion(id: string): Promise<Resultado<Publicacion>> {
  const r = await pedir<{ data: Publicacion }>(`/api/publications/${id}`, {}, true);
  return r.error ? r : { data: r.data.data, error: null };
}