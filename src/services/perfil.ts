import { isAuthRetryableFetchError, type PostgrestError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { TipoUsuario, Usuario } from '@/services/auth';

// =====================================================================
// Sprint 3 · Gestión de perfil (PB04 / HU01)
// API de edición de perfil sobre Supabase:
//   GET   /rest/v1/usuarios?id=eq.<id>         -> obtenerPerfil (auth.ts)
//   PATCH /rest/v1/usuarios?id=eq.<id>         -> actualizarPerfil
//   POST  /storage/v1/object/avatares/<id>/... -> subirFotoPerfil
// Las mismas reglas se validan aquí (respuesta inmediata en la pantalla)
// y en la BD (trigger validar_perfil_usuario), que es la que manda.
// =====================================================================

/** Campos que el usuario puede editar (los demás están bloqueados en la BD). */
export type CambiosPerfil = Partial<{
  nombre: string;
  telefono: string | null;
  fecha_nacimiento: string | null; // 'AAAA-MM-DD'
  tipo_usuario: TipoUsuario;
  latitud: number | null;
  longitud: number | null;
  foto_url: string | null;
}>;

export type CampoPerfil =
  | 'nombre'
  | 'telefono'
  | 'fecha_nacimiento'
  | 'tipo_usuario'
  | 'ubicacion'
  | 'foto_url';

export type ErroresPerfil = Partial<Record<CampoPerfil, string>>;

export type ResultadoPerfil = {
  perfil: Usuario | null;
  error: string | null;
  /** Campo al que pertenece el error, para marcarlo en rojo en el formulario. */
  campo?: CampoPerfil;
};

export const NOMBRE_MIN = 2;
export const NOMBRE_MAX = 80;
export const TELEFONO_REGEX = /^\+?[0-9]{10,15}$/;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'] as const;
const FOTO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB, igual que el bucket

/** Quita espacios, guiones y paréntesis: "442 123-4567" -> "4421234567". */
export function limpiarTelefono(telefono: string): string {
  return telefono.replace(/[\s\-()]/g, '');
}

// ---------- Validaciones (antes de llamar a Supabase) ----------

export function validarPerfil(cambios: CambiosPerfil): ErroresPerfil {
  const errores: ErroresPerfil = {};

  if (cambios.nombre !== undefined) {
    const nombre = cambios.nombre.trim();
    if (nombre.length < NOMBRE_MIN) errores.nombre = 'Ingresa tu nombre.';
    else if (nombre.length > NOMBRE_MAX) {
      errores.nombre = `El nombre no puede tener más de ${NOMBRE_MAX} caracteres.`;
    }
  }

  if (cambios.telefono) {
    if (!TELEFONO_REGEX.test(limpiarTelefono(cambios.telefono))) {
      errores.telefono = 'El teléfono debe tener entre 10 y 15 dígitos.';
    }
  }

  if (cambios.fecha_nacimiento) {
    const fecha = new Date(`${cambios.fecha_nacimiento}T00:00:00`);
    const hoy = new Date();
    const minima = new Date(hoy.getFullYear() - 120, hoy.getMonth(), hoy.getDate());
    if (!FECHA_REGEX.test(cambios.fecha_nacimiento) || Number.isNaN(fecha.getTime())) {
      errores.fecha_nacimiento = 'Usa el formato AAAA-MM-DD.';
    } else if (fecha > hoy) {
      errores.fecha_nacimiento = 'La fecha de nacimiento no puede estar en el futuro.';
    } else if (fecha < minima) {
      errores.fecha_nacimiento = 'La fecha de nacimiento no es válida.';
    }
  }

  if (cambios.tipo_usuario !== undefined) {
    if (cambios.tipo_usuario !== 'CLIENTE' && cambios.tipo_usuario !== 'PRESTADOR') {
      errores.tipo_usuario = 'Elige si eres cliente o prestador.';
    }
  }

  if (cambios.latitud !== undefined || cambios.longitud !== undefined) {
    const { latitud, longitud } = cambios;
    if ((latitud == null) !== (longitud == null)) {
      errores.ubicacion = 'La ubicación debe incluir latitud y longitud.';
    } else if (latitud != null && longitud != null) {
      if (latitud < -90 || latitud > 90 || longitud < -180 || longitud > 180) {
        errores.ubicacion = 'La ubicación no es válida.';
      }
    }
  }

  if (cambios.foto_url && !cambios.foto_url.startsWith('https://')) {
    errores.foto_url = 'La foto de perfil debe ser una URL https.';
  }

  return errores;
}

// ---------- Operaciones ----------

/**
 * Actualiza solo los campos enviados del perfil del usuario.
 * Regresa el perfil ya guardado (con los valores normalizados por la BD).
 */
export async function actualizarPerfil(
  idUsuario: string,
  cambios: CambiosPerfil
): Promise<ResultadoPerfil> {
  const errores = validarPerfil(cambios);
  const primerCampo = Object.keys(errores)[0] as CampoPerfil | undefined;
  if (primerCampo) {
    return { perfil: null, error: errores[primerCampo] ?? null, campo: primerCampo };
  }

  const datos: CambiosPerfil = { ...cambios };
  if (datos.nombre !== undefined) datos.nombre = datos.nombre.trim();
  if (datos.telefono !== undefined) {
    datos.telefono = datos.telefono ? limpiarTelefono(datos.telefono) : null;
  }
  if (Object.keys(datos).length === 0) {
    return { perfil: null, error: 'No hay cambios que guardar.' };
  }

  const { data, error } = await supabase
    .from('usuarios')
    .update(datos)
    .eq('id', idUsuario)
    .select()
    .maybeSingle();

  if (error) return { perfil: null, ...traducirErrorPerfil(error) };
  if (!data) {
    // RLS: el id no es el del usuario con sesión, o el perfil no existe
    return { perfil: null, error: 'No se encontró tu perfil. Vuelve a iniciar sesión.' };
  }
  return { perfil: data as Usuario, error: null };
}

/**
 * Sube la foto al bucket "avatares" (carpeta = id del usuario) y guarda su URL en el perfil.
 * `uri` y `tipoMime` son los que regresa expo-image-picker (asset.uri / asset.mimeType).
 */
export async function subirFotoPerfil(
  idUsuario: string,
  uri: string,
  tipoMime: string = 'image/jpeg'
): Promise<ResultadoPerfil> {
  if (!TIPOS_FOTO.includes(tipoMime as (typeof TIPOS_FOTO)[number])) {
    return { perfil: null, error: 'La foto debe ser JPG, PNG o WEBP.', campo: 'foto_url' };
  }

  let contenido: ArrayBuffer;
  try {
    contenido = await (await fetch(uri)).arrayBuffer();
  } catch {
    return { perfil: null, error: 'No se pudo leer la imagen seleccionada.', campo: 'foto_url' };
  }
  if (contenido.byteLength > FOTO_MAX_BYTES) {
    return { perfil: null, error: 'La foto no puede pesar más de 2 MB.', campo: 'foto_url' };
  }

  const extension = tipoMime.split('/')[1].replace('jpeg', 'jpg');
  const ruta = `${idUsuario}/avatar.${extension}`;

  const { error: errorSubida } = await supabase.storage
    .from('avatares')
    .upload(ruta, contenido, { contentType: tipoMime, upsert: true });

  if (errorSubida) {
    console.warn('Error al subir foto:', errorSubida.message);
    return { perfil: null, error: 'No se pudo subir la foto. Inténtalo de nuevo.', campo: 'foto_url' };
  }

  const { data } = supabase.storage.from('avatares').getPublicUrl(ruta);
  // ?v= evita que la app muestre la foto anterior guardada en caché
  return actualizarPerfil(idUsuario, { foto_url: `${data.publicUrl}?v=${Date.now()}` });
}

// ---------- Mensajes de error en español ----------

const CAMPOS_VALIDOS: CampoPerfil[] = [
  'nombre',
  'telefono',
  'fecha_nacimiento',
  'tipo_usuario',
  'ubicacion',
  'foto_url',
];

function traducirErrorPerfil(error: PostgrestError): { error: string; campo?: CampoPerfil } {
  switch (error.code) {
    case '22023': {
      // Mensaje en español que viene del trigger validar_perfil_usuario
      const campo = CAMPOS_VALIDOS.find((c) => c === error.hint);
      return { error: error.message, campo };
    }
    case '42501':
      return { error: 'No tienes permiso para modificar ese dato.' };
    case 'PGRST301':
    case 'PGRST303':
      return { error: 'Tu sesión expiró. Vuelve a iniciar sesión.' };
  }
  if (isAuthRetryableFetchError(error) || error.message?.includes('Network request failed')) {
    return { error: 'No hay conexión con el servidor. Revisa tu internet.' };
  }
  console.warn('Error al actualizar perfil:', error.code, error.message);
  return { error: 'Ocurrió un error inesperado. Inténtalo de nuevo.' };
}
