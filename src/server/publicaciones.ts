// src/server/publicaciones.ts — Lógica de negocio de publicaciones (solo servidor)
//
// Cadena completa del servidor:
//   Prestador → Perfil con foto → Límite → [cadena base: título, descripción,
//   precio, categoría, ubicación, imágenes, contenido] → Categoría existe → Imágenes propias
// y al final la base de datos vuelve a validar todo (trigger validar_publicacion).

import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import {
  BUCKET_PUBLICACIONES,
  REGLAS,
  type CampoPublicacion,
  type Categoria,
  type NuevaPublicacion,
  type Publicacion,
} from '@/lib/publicaciones/tipos';
import {
  ValidadorCategoriaFormato,
  ValidadorContenidoRestringido,
  ValidadorDescripcion,
  ValidadorImagenesFormato,
  ValidadorPrecio,
  ValidadorTitulo,
  ValidadorUbicacion,
  Validador,
  construirCadena,
  ejecutarCadena,
  type ContextoValidacion,
} from '@/lib/publicaciones/validadores';
import { urlBaseBucket } from '@/server/supabase';

// ---------------------------------------------------------------------
// Eslabones que consultan la base de datos
// ---------------------------------------------------------------------

type PerfilAutor = {
  tipo_usuario: string | null;
  estado_cuenta: string;
  foto_url: string | null;
};

/** Solo un PRESTADOR con cuenta activa puede publicar (Gherkin HU-04/HU-05). */
class ValidadorPrestador extends Validador {
  constructor(private perfil: PerfilAutor | null) {
    super();
  }
  protected validar(ctx: ContextoValidacion) {
    if (!this.perfil) {
      ctx.fallo = { estado: 403, codigo: 'SIN_PERMISO', mensaje: 'No se encontró tu perfil.' };
    } else if (this.perfil.estado_cuenta !== 'ACTIVA') {
      ctx.fallo = { estado: 403, codigo: 'SIN_PERMISO', mensaje: 'Tu cuenta no está activa.' };
    } else if (this.perfil.tipo_usuario !== 'PRESTADOR') {
      ctx.fallo = {
        estado: 403,
        codigo: 'SIN_PERMISO',
        mensaje: 'Solo los prestadores pueden publicar. Cambia tu tipo de cuenta en tu perfil.',
      };
    }
  }
}

/** El prestador debe tener foto de perfil para publicar (confianza para los clientes). */
class ValidadorFotoPerfil extends Validador {
  constructor(private perfil: PerfilAutor | null) {
    super();
  }
  protected validar(ctx: ContextoValidacion) {
    if (!this.perfil?.foto_url) {
      ctx.fallo = {
        estado: 403,
        codigo: 'PERFIL_INCOMPLETO',
        mensaje: 'Sube tu foto de perfil antes de publicar.',
      };
    }
  }
}

/** Máximo de publicaciones activas por prestador (Problema 7). */
class ValidadorLimite extends Validador {
  constructor(private supabase: SupabaseClient, private idUsuario: string) {
    super();
  }
  protected async validar(ctx: ContextoValidacion) {
    const { count, error } = await this.supabase
      .from('publicaciones')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', this.idUsuario)
      .or('estado_moderacion.is.null,estado_moderacion.neq.RECHAZADA');
    if (error) throw error;
    if ((count ?? 0) >= REGLAS.LIMITE_PUBLICACIONES) {
      ctx.fallo = {
        estado: 409,
        codigo: 'LIMITE_ALCANZADO',
        mensaje: `Alcanzaste el máximo de ${REGLAS.LIMITE_PUBLICACIONES} publicaciones activas.`,
      };
    }
  }
}

/** La categoría existe y está activa (solo si el formato ya era correcto). */
class ValidadorCategoriaExiste extends Validador {
  constructor(private supabase: SupabaseClient) {
    super();
  }
  protected async validar(ctx: ContextoValidacion) {
    if (ctx.errores.categoria_id) return;
    const { data, error } = await this.supabase
      .from('categorias')
      .select('id, tipo')
      .eq('id', ctx.datos.categoria_id)
      .maybeSingle();
    if (error) throw error;
    if (!data) this.error(ctx, 'categoria_id', 'La categoría no existe o no está disponible.');
    else if (data.tipo !== 'PRODUCTO' && data.tipo !== 'SERVICIO') {
      this.error(ctx, 'categoria_id', 'La categoría no tiene tipo. Elige otra.');
    }
  }
}

/** Cada foto debe estar en la carpeta del usuario: "<id>/archivo.jpg". */
class ValidadorImagenesPropias extends Validador {
  constructor(private idUsuario: string) {
    super();
  }
  protected validar(ctx: ContextoValidacion) {
    if (ctx.errores.imagenes) return;
    if (ctx.datos.imagenes.some((ruta) => ruta.split('/')[0] !== this.idUsuario)) {
      this.error(ctx, 'imagenes', 'Solo puedes usar fotografías que subiste tú.');
    }
  }
}

export async function validarEnServidor(
  supabase: SupabaseClient,
  idUsuario: string,
  datos: NuevaPublicacion
): Promise<ContextoValidacion> {
  const { data: perfil, error } = await supabase
    .from('usuarios')
    .select('tipo_usuario, estado_cuenta, foto_url')
    .eq('id', idUsuario)
    .maybeSingle();
  if (error) throw error;

  const cadena = construirCadena(
    new ValidadorPrestador(perfil),
    new ValidadorFotoPerfil(perfil),
    new ValidadorLimite(supabase, idUsuario),
    new ValidadorTitulo(),
    new ValidadorDescripcion(),
    new ValidadorPrecio(),
    new ValidadorCategoriaFormato(),
    new ValidadorCategoriaExiste(supabase),
    new ValidadorUbicacion(),
    new ValidadorImagenesFormato(),
    new ValidadorImagenesPropias(idUsuario),
    new ValidadorContenidoRestringido()
  );
  return ejecutarCadena(cadena, datos);
}

// ---------------------------------------------------------------------
// Errores de la base de datos -> respuesta HTTP
// ---------------------------------------------------------------------

const CAMPOS: CampoPublicacion[] = [
  'cuerpo', 'titulo', 'descripcion', 'precio', 'unidad_precio', 'categoria_id', 'imagenes', 'ubicacion',
];

export type ErrorTraducido = {
  estado: number;
  codigo: 'VALIDACION' | 'SIN_PERMISO' | 'LIMITE_ALCANZADO' | 'NO_AUTENTICADO' | 'ERROR_INTERNO';
  mensaje: string;
  campo?: CampoPublicacion;
};

export function traducirErrorBD(error: PostgrestError): ErrorTraducido {
  if (error.hint === 'limite') {
    return { estado: 409, codigo: 'LIMITE_ALCANZADO', mensaje: error.message };
  }
  if (error.code === '22023') {
    const campo = CAMPOS.find((c) => c === error.hint);
    return { estado: 400, codigo: 'VALIDACION', mensaje: error.message, campo };
  }
  if (error.code === '42501') {
    return { estado: 403, codigo: 'SIN_PERMISO', mensaje: error.message || 'No tienes permiso.' };
  }
  if (error.code === 'PGRST301' || error.code === 'PGRST303') {
    return { estado: 401, codigo: 'NO_AUTENTICADO', mensaje: 'Tu sesión expiró. Vuelve a iniciar sesión.' };
  }
  console.error('[api] error de base de datos:', error.code, error.message);
  return { estado: 500, codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado. Inténtalo de nuevo.' };
}

// ---------------------------------------------------------------------
// Operaciones
// ---------------------------------------------------------------------

type FilaPublicacion = Omit<Publicacion, 'precio' | 'latitud' | 'longitud' | 'destacada'> & {
  precio: number | string;
  latitud: number | string | null;
  longitud: number | string | null;
  destacada: boolean | null;
};

/** Ordena las imágenes y asegura que los números lleguen como number. */
export function aPublicacion(fila: FilaPublicacion): Publicacion {
  return {
    ...fila,
    precio: Number(fila.precio),
    latitud: fila.latitud == null ? null : Number(fila.latitud),
    longitud: fila.longitud == null ? null : Number(fila.longitud),
    destacada: !!fila.destacada,
    imagenes: [...(fila.imagenes ?? [])].sort((a, b) => a.orden - b.orden),
  };
}

export async function crearPublicacion(supabase: SupabaseClient, datos: NuevaPublicacion) {
  const { data, error } = await supabase.rpc('crear_publicacion', {
    datos,
    url_base: urlBaseBucket(BUCKET_PUBLICACIONES),
  });
  if (error) return { publicacion: null, error: traducirErrorBD(error) };
  return { publicacion: aPublicacion(data as FilaPublicacion), error: null };
}

export const SELECT_PUBLICACION = `
  id, usuario_id, tipo, titulo, descripcion, precio, unidad_precio, latitud, longitud,
  disponibilidad, estado_moderacion, destacada, creado_en, actualizado_en,
  categoria:categorias ( id, nombre, slug, tipo ),
  imagenes:imagenes_publicacion ( id, url, ruta, orden )
`;

export type FiltrosListado = {
  categoriaId?: number;
  tipo?: 'PRODUCTO' | 'SERVICIO';
  usuarioId?: string;
  soloMias?: boolean;
  limite: number;
  pagina: number;
};

export async function listarPublicaciones(supabase: SupabaseClient, f: FiltrosListado) {
  let consulta = supabase.from('publicaciones').select(SELECT_PUBLICACION, { count: 'exact' });

  if (f.soloMias && f.usuarioId) {
    consulta = consulta.eq('usuario_id', f.usuarioId);
  } else {
    // Lo que ven los clientes: aprobadas y disponibles
    consulta = consulta.eq('estado_moderacion', 'APROBADA').eq('disponibilidad', 'DISPONIBLE');
  }
  if (f.categoriaId) consulta = consulta.eq('categoria_id', f.categoriaId);
  if (f.tipo) consulta = consulta.eq('tipo', f.tipo);

  // Destacadas primero (Sprint 11) y luego las más nuevas
  const { data, error, count } = await consulta
    .order('destacada', { ascending: false, nullsFirst: false })
    .order('creado_en', { ascending: false })
    .range((f.pagina - 1) * f.limite, f.pagina * f.limite - 1);
  if (error) return { error: traducirErrorBD(error) };
  return {
    error: null,
    publicaciones: (data as unknown as FilaPublicacion[]).map(aPublicacion),
    total: count ?? 0,
  };
}

export async function obtenerPublicacion(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from('publicaciones')
    .select(SELECT_PUBLICACION)
    .eq('id', id)
    .maybeSingle();
  if (error) return { error: traducirErrorBD(error), publicacion: null };
  return { error: null, publicacion: data ? aPublicacion(data as unknown as FilaPublicacion) : null };
}

export async function listarCategorias(supabase: SupabaseClient, tipo?: 'PRODUCTO' | 'SERVICIO') {
  let consulta = supabase
    .from('categorias')
    .select('id, nombre, slug, tipo, icono, orden, solo_mayores')
    .in('tipo', ['PRODUCTO', 'SERVICIO'])   // las categorías sin tipo no se pueden usar
    .order('orden')
    .order('nombre');
  if (tipo) consulta = consulta.eq('tipo', tipo);
  const { data, error } = await consulta;
  if (error) return { error: traducirErrorBD(error), categorias: [] as Categoria[] };
  return { error: null, categorias: data as Categoria[] };
}