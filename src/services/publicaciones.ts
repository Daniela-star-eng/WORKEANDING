// src/services/publicaciones.ts — Cliente de la API de publicaciones para las pantallas (Sprints 4 y 5)
//
// Uso típico en el formulario de "Nueva publicación" (Sprint 4):
//
//   const categorias = await obtenerCategorias('SERVICIO');
//   const { rutas, error } = await subirImagenesPublicacion(fotosElegidas); // de expo-image-picker
//   const r = await crearPublicacion({ titulo, descripcion, precio, unidad_precio, categoria_id, imagenes: rutas });
//   if (r.error) mostrar(r.error.campos?.titulo ...)
//
// Galería al editar (Sprint 5):
//
//   const [fotos, setFotos] = useState(fotosDePublicacion(publicacion));
//   <GaleriaEditable fotos={fotos} onChange={setFotos} />
//   const r = await guardarGaleria(publicacion.id, fotos);  // sube nuevas, sincroniza y borra descartadas
//
// Las peticiones van a las rutas de API del mismo proyecto (src/app/api).
// En desarrollo, Expo resuelve '/api/...' contra el servidor de `npx expo start`.

import { supabase } from '@/lib/supabase';
import {
  BUCKET_PUBLICACIONES,
  REGLAS,
  type Categoria,
  type GaleriaActualizada,
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

/** Borra del bucket fotos que se subieron pero no se usaron (p. ej. al fallar el guardado). */
export async function borrarFotosSubidas(rutas: string[]): Promise<void> {
  if (rutas.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET_PUBLICACIONES).remove(rutas);
  if (error) console.warn('No se pudieron borrar fotos sin usar:', error.message);
}

/**
 * Sube fotos al bucket "publicaciones" en la carpeta del usuario y regresa sus rutas
 * en el mismo orden. Si una falla, borra las que ya había subido (no deja basura).
 */
export async function subirFotos(fotos: FotoElegida[]): Promise<{ rutas: string[]; error: string | null }> {
  const { data } = await supabase.auth.getSession();
  const idUsuario = data.session?.user.id;
  if (!idUsuario) return { rutas: [], error: 'Inicia sesión para subir fotografías.' };

  const rutas: string[] = [];
  const fallar = async (error: string) => {
    await borrarFotosSubidas(rutas);
    return { rutas: [], error };
  };

  for (const foto of fotos) {
    const tipo = foto.mimeType ?? 'image/jpeg';
    const extension = TIPOS_FOTO[tipo];
    if (!extension) return fallar('Las fotografías deben ser JPG, PNG o WEBP.');

    let contenido: ArrayBuffer;
    try {
      contenido = await (await fetch(foto.uri)).arrayBuffer();
    } catch {
      return fallar('No se pudo leer una de las fotografías.');
    }
    if (contenido.byteLength > REGLAS.IMAGEN_MAX_BYTES) {
      return fallar('Cada fotografía puede pesar máximo 5 MB.');
    }

    const nombre = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ruta = `${idUsuario}/${nombre}.${extension}`;
    const { error } = await supabase.storage
      .from(BUCKET_PUBLICACIONES)
      .upload(ruta, contenido, { contentType: tipo, upsert: false });
    if (error) {
      console.warn('Error al subir foto de publicación:', error.message);
      return fallar('No se pudo subir una de las fotografías. Inténtalo de nuevo.');
    }
    rutas.push(ruta);
  }
  return { rutas, error: null };
}

/**
 * Sube las fotos de una publicación NUEVA (de 1 a 8) y regresa sus rutas,
 * listas para mandarlas en `imagenes` de crearPublicacion().
 */
export async function subirImagenesPublicacion(
  fotos: FotoElegida[]
): Promise<{ rutas: string[]; error: string | null }> {
  if (fotos.length < REGLAS.IMAGENES_MIN) return { rutas: [], error: 'Agrega al menos una fotografía.' };
  if (fotos.length > REGLAS.IMAGENES_MAX) {
    return { rutas: [], error: `Puedes agregar máximo ${REGLAS.IMAGENES_MAX} fotografías.` };
  }
  return subirFotos(fotos);
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

// ---------- Galería al editar (Sprint 5) ----------

/**
 * Una foto del formulario de edición:
 *   - 'guardada': ya pertenece a la publicación (se identifica por su ruta en el bucket)
 *   - 'nueva': elegida con el selector, todavía no se sube
 * El orden del arreglo es el orden final; la primera es la portada.
 */
export type FotoGaleria =
  | { clave: string; tipo: 'guardada'; ruta: string; url: string }
  | ({ clave: string; tipo: 'nueva' } & FotoElegida);

let contador = 0;
export const nuevaClave = () => `foto-${Date.now()}-${contador++}`;

/** Ruta del archivo; las fotos viejas sin "ruta" la tienen dentro de la URL pública. */
function rutaDeImagen(imagen: Publicacion['imagenes'][number]): string {
  return imagen.ruta || imagen.url;
}

/** Estado inicial del formulario a partir de la publicación guardada. */
export function fotosDePublicacion(publicacion: Publicacion): FotoGaleria[] {
  return [...publicacion.imagenes]
    .sort((a, b) => a.orden - b.orden)
    .map((img) => ({ clave: img.id, tipo: 'guardada', ruta: rutaDeImagen(img), url: img.url }));
}

/** ¿El usuario cambió algo respecto a lo guardado? */
export function galeriaCambio(publicacion: Publicacion, fotos: FotoGaleria[]): boolean {
  const antes = fotosDePublicacion(publicacion).map((f) => (f.tipo === 'guardada' ? f.ruta : ''));
  const ahora = fotos.map((f) => (f.tipo === 'guardada' ? f.ruta : f.clave));
  return antes.length !== ahora.length || antes.some((r, i) => r !== ahora[i]);
}

/**
 * Guarda la galería editada:
 *   1. Sube las fotos nuevas al bucket.
 *   2. Manda la lista final a PUT /api/publications/:id/images (la BD sincroniza en una transacción
 *      y la API borra del bucket las fotos que quitaste o reemplazaste).
 *   3. Si el guardado falla, borra las fotos que acababa de subir.
 */
export async function guardarGaleria(
  idPublicacion: string,
  fotos: FotoGaleria[]
): Promise<Resultado<GaleriaActualizada>> {
  if (fotos.length < REGLAS.IMAGENES_MIN) {
    return { data: null, error: { codigo: 'VALIDACION', mensaje: 'La publicación debe tener al menos una fotografía.', campos: { imagenes: 'La publicación debe tener al menos una fotografía.' } } };
  }
  if (fotos.length > REGLAS.IMAGENES_MAX) {
    const mensaje = `Puedes tener máximo ${REGLAS.IMAGENES_MAX} fotografías.`;
    return { data: null, error: { codigo: 'VALIDACION', mensaje, campos: { imagenes: mensaje } } };
  }

  const nuevas = fotos.filter((f): f is Extract<FotoGaleria, { tipo: 'nueva' }> => f.tipo === 'nueva');
  const subida = await subirFotos(nuevas);
  if (subida.error) {
    return { data: null, error: { codigo: 'VALIDACION', mensaje: subida.error, campos: { imagenes: subida.error } } };
  }

  // Lista final en el orden de la pantalla
  const rutaDeNueva = new Map(nuevas.map((f, i) => [f.clave, subida.rutas[i]]));
  const imagenes = fotos.map((f) => (f.tipo === 'guardada' ? f.ruta : rutaDeNueva.get(f.clave)!));

  const r = await pedir<GaleriaActualizada>(
    `/api/publications/${idPublicacion}/images`,
    { method: 'PUT', body: JSON.stringify({ imagenes }) },
    true
  );
  if (r.error) await borrarFotosSubidas(subida.rutas);
  return r;
}