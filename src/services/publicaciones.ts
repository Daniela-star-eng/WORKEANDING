import { supabase } from '@/lib/supabase';
import { leerImagen, type FotoLocal } from '@/services/imagenes';
import { detectarFormato, validarCantidad, validarTamano } from '@/utils/validarImagenes';

// Esquema real del equipo: no utiliza tablas ni buckets adicionales.
const BUCKET = 'publicaciones';
export type Categoria = { id: number; nombre: string; tipo: string | null };
export type FotoGuardada = { id: string; ruta: string | null; url: string; orden: number | null };
export type Publicacion = { id: string; titulo: string; descripcion: string | null;
  estado_moderacion: string | null; imagenes: FotoGuardada[] };

async function usuarioActual(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('No se pudo verificar tu sesión. Revisa la conexión o inicia sesión de nuevo.');
  return data.user.id;
}
function fallo(contexto: string, error: { message: string; code?: string } | null): Error {
  return new Error(`${contexto}${error ? ` (${error.code ?? 'Supabase'}: ${error.message})` : ''}`);
}
export async function listarCategorias(): Promise<Categoria[]> {
  const { data, error } = await supabase.from('categorias').select('id,nombre,tipo')
    .eq('activa', true).order('orden').order('nombre');
  if (error) throw fallo('No se pudieron consultar las categorías.', error);
  return data as Categoria[];
}
export async function listarPublicaciones(): Promise<Publicacion[]> {
  const usuario = await usuarioActual();
  const { data, error } = await supabase.from('publicaciones')
    .select('id,titulo,descripcion,estado_moderacion,imagenes:imagenes_publicacion(id,url,orden,ruta)')
    .eq('usuario_id', usuario).order('creado_en', { ascending: false }).limit(20);
  if (error) throw fallo('No se pudieron consultar tus publicaciones.', error);
  return (data as unknown as Publicacion[]).map(p => ({ ...p,
    imagenes: [...(p.imagenes ?? [])].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)) }));
}
export function convertirPrecio(texto: string): number {
  const limpio = texto.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(limpio)) throw new Error('Ingresa un precio válido, con máximo dos decimales.');
  const precio = Number(limpio);
  if (!Number.isFinite(precio) || precio <= 0 || precio * 100 > Number.MAX_SAFE_INTEGER) {
    throw new Error('El precio debe ser mayor a 0 y estar dentro de un valor válido.');
  }
  return precio;
}
export function validarPublicacion(titulo: string, descripcion: string, fotos: FotoLocal[], categoriaId: number, precio: number) {
  if (!Number.isFinite(precio) || precio <= 0) throw new Error('El precio debe ser mayor a 0.');
  if (descripcion.trim().length < 20) throw new Error('La descripción debe tener al menos 20 caracteres.');
  if (!Number.isSafeInteger(categoriaId) || categoriaId <= 0) throw new Error('Selecciona una categoría válida.');
  if (titulo.trim().length < 3 || titulo.trim().length > 100) throw new Error('El título debe tener entre 3 y 100 caracteres.');
  if (descripcion.trim().length > 2000) throw new Error('La descripción no puede superar 2000 caracteres.');
  validarCantidad(fotos.length);
  if (new Set(fotos.map(f => f.id)).size !== fotos.length) throw new Error('La selección contiene identificadores duplicados.');
}

/** Un ID por intento y un ID por foto permiten consultar el resultado y reintentar sin duplicar.
 * No usa UPDATE/upsert en imagenes_publicacion: sus políticas actuales no permiten UPDATE.
 */
export async function publicarConFotos(id: string, titulo: string, descripcion: string,
  fotos: FotoLocal[], categoriaId: number, precio: number, progreso: (mensaje: string) => void): Promise<string> {
  validarPublicacion(titulo, descripcion, fotos, categoriaId, precio);
  const usuario = await usuarioActual();
  const carpeta = `${usuario}/${id}`;
  const { data: previa, error: errorConsulta } = await supabase.from('publicaciones')
    .select('id').eq('id', id).eq('usuario_id', usuario).maybeSingle();
  if (errorConsulta) throw fallo('No se pudo comprobar el intento. Conserva la selección y reintenta.', errorConsulta);
  const { data: registradas, error: errorFotos } = await supabase.from('imagenes_publicacion')
    .select('id,ruta,url,orden').eq('publicacion_id', id);
  if (errorFotos) throw fallo('No se pudieron comprobar las fotografías guardadas.', errorFotos);
  const existentes = (registradas ?? []) as FotoGuardada[];
  for (const existente of existentes) {
    const indice = fotos.findIndex(f => f.id === existente.id);
    if (indice < 0 || existente.orden !== indice + 1 || existente.ruta !== `${carpeta}/${existente.id}.jpg`) {
      throw new Error('La publicación cambió fuera de este intento. No se sobrescribieron sus fotografías.');
    }
  }
  if (previa && existentes.length === fotos.length) return id;
  let categoria: Categoria | null = null;
  if (!previa) {
    const { data, error } = await supabase.from('categorias').select('id,nombre,tipo')
      .eq('id', categoriaId).eq('activa', true).maybeSingle();
    if (error || !data) throw fallo('La categoría no está disponible. Descarta el intento para seleccionar otra.', error);
    categoria = data as Categoria;
  }
  // Si se cerró la app, podemos reutilizar archivos ya subidos aunque se haya limpiado la caché local.
  const { data: objetos, error: errorObjetos } = await supabase.storage.from(BUCKET).list(carpeta, { limit: 100 });
  if (errorObjetos) throw fallo('No se pudo comprobar Storage. Reintenta.', errorObjetos);
  const nombres = new Set((objetos ?? []).filter(o => o.id).map(o => o.name));
  const nuevas: Array<FotoGuardada & { publicacion_id: string }> = [];
  for (let i = 0; i < fotos.length; i++) {
    const foto = fotos[i];
    const ruta = `${carpeta}/${foto.id}.jpg`;
    if (existentes.some(f => f.id === foto.id)) continue;
    progreso(`Procesando fotografía ${i + 1} de ${fotos.length}…`);
    if (!nombres.has(`${foto.id}.jpg`)) {
      const contenido = await leerImagen(foto.uri);
      validarTamano(contenido.byteLength);
      if (detectarFormato(new Uint8Array(contenido)) !== 'image/jpeg') throw new Error('La imagen no está optimizada a JPG.');
      const { error } = await supabase.storage.from(BUCKET).upload(ruta, contenido, {
        contentType: 'image/jpeg', upsert: false, cacheControl: '3600',
      });
      if (error) throw fallo(`No se pudo confirmar la foto ${i + 1}. Pulsa Reintentar; no se borró el intento.`, error);
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta);
    nuevas.push({ id: foto.id, publicacion_id: id, ruta, url: data.publicUrl, orden: i + 1 });
  }
  if (!previa) {
    progreso('Guardando publicación…');
    const { error } = await supabase.from('publicaciones').insert({
      id, usuario_id: usuario, categoria_id: categoriaId, precio,
      titulo: titulo.trim(), descripcion: descripcion.trim(), tipo: categoria?.tipo ?? null,
      // Moderación, disponibilidad y fechas usan los valores predeterminados de tu BD.
    });
    if (error) throw fallo('No se pudo confirmar la publicación. Reintenta con el mismo ID.', error);
  }
  progreso('Guardando URLs y orden…');
  if (nuevas.length) {
    // INSERT en lote: todas estas filas se guardan en una sola operación de base de datos.
    const { error } = await supabase.from('imagenes_publicacion').insert(nuevas);
    if (error) throw fallo('No se pudo confirmar el registro de fotos. La publicación puede existir; Reintentar completará el mismo intento.', error);
  }
  return id;
}

/** Solo descarta archivos cuando todavía NO hay una publicación creada.
 * La BD del equipo no tiene política DELETE de publicaciones: no se agrega ni se evita.
 */
export async function descartarIntento(id: string, fotos: FotoLocal[]): Promise<void> {
  const usuario = await usuarioActual();
  const { data, error } = await supabase.from('publicaciones').select('id')
    .eq('id', id).eq('usuario_id', usuario).maybeSingle();
  if (error) throw fallo('No se pudo comprobar el estado del intento.', error);
  if (data) throw new Error('La publicación ya existe. Pulsa Reintentar para completar o recuperar el guardado. No se eliminó ningún dato.');
  const rutas = fotos.map(f => `${usuario}/${id}/${f.id}.jpg`);
  if (!rutas.length) return;
  const { error: limpieza } = await supabase.storage.from(BUCKET).remove(rutas);
  if (limpieza) throw fallo('No se pudieron limpiar los archivos. Reintenta cuando tengas conexión.', limpieza);
}


/** Elimina una publicación propia y sus imágenes asociadas. */
export async function eliminarPublicacion(id: string): Promise<void> {
  const usuario = await usuarioActual();

  const { data: publicacion, error: errorConsulta } = await supabase
    .from('publicaciones')
    .select('id')
    .eq('id', id)
    .eq('usuario_id', usuario)
    .maybeSingle();

  if (errorConsulta) {
    throw fallo('No se pudo comprobar la publicación.', errorConsulta);
  }

  if (!publicacion) {
    throw new Error('La publicación no existe o no tienes permiso para eliminarla.');
  }

  const { data: imagenes, error: errorImagenes } = await supabase
    .from('imagenes_publicacion')
    .select('ruta')
    .eq('publicacion_id', id);

  if (errorImagenes) {
    throw fallo('No se pudieron consultar las imágenes.', errorImagenes);
  }

  const { error: errorEliminar } = await supabase
    .from('publicaciones')
    .delete()
    .eq('id', id)
    .eq('usuario_id', usuario);

  if (errorEliminar) {
    throw fallo('No se pudo eliminar la publicación. Verifica los permisos DELETE de la base de datos.', errorEliminar);
  }

  const rutas = (imagenes ?? [])
    .map(imagen => imagen.ruta)
    .filter((ruta): ruta is string => Boolean(ruta));

  if (rutas.length) {
    const { error: errorStorage } = await supabase.storage
      .from(BUCKET)
      .remove(rutas);

    if (errorStorage) {
      throw fallo('La publicación se eliminó, pero algunas imágenes siguen almacenadas.', errorStorage);
    }
  }
}
