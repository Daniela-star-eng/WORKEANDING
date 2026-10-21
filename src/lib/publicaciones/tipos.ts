// src/lib/publicaciones/tipos.ts — Contrato de datos de publicaciones (Sprint 4)
// Lo comparten la API (src/app/api) y la app (src/services/publicaciones.ts).
// Debe coincidir con supabase/03_sprint4_publicaciones.sql y docs/openapi.json.

export const TIPOS_PUBLICACION = ['PRODUCTO', 'SERVICIO'] as const;
export type TipoPublicacion = (typeof TIPOS_PUBLICACION)[number];

export const UNIDADES_PRECIO = ['HORA', 'DIA', 'SEMANA', 'MES', 'EVENTO', 'SERVICIO'] as const;
export type UnidadPrecio = (typeof UNIDADES_PRECIO)[number];

export const DISPONIBILIDADES = ['DISPONIBLE', 'NO_DISPONIBLE', 'EN_RENTA'] as const;
export type Disponibilidad = (typeof DISPONIBILIDADES)[number];

/** Columna estado_moderacion: APROBADA = visible para clientes; PENDIENTE = en revisión */
export const ESTADOS_MODERACION = ['PENDIENTE', 'APROBADA', 'RECHAZADA'] as const;
export type EstadoModeracion = (typeof ESTADOS_MODERACION)[number];

export const REGLAS = {
  TITULO_MIN: 5,
  TITULO_MAX: 100,
  DESCRIPCION_MIN: 20,
  DESCRIPCION_MAX: 2000,
  PRECIO_MAX: 999_999.99,
  IMAGENES_MIN: 1,
  IMAGENES_MAX: 8,
  IMAGEN_MAX_BYTES: 5 * 1024 * 1024,
  LIMITE_PUBLICACIONES: 20,
} as const;

/** Bucket de Supabase Storage donde viven las fotos de las publicaciones. */
export const BUCKET_PUBLICACIONES = 'publicaciones';

export type Categoria = {
  id: number;
  nombre: string;
  slug: string;
  tipo: TipoPublicacion;
  icono: string | null;
  orden: number;
  /** Contenido solo para mayores de edad (Problema 5) */
  solo_mayores: boolean;
};

export type ImagenPublicacion = {
  id: string;
  /** URL pública lista para usarse en <Image source={{ uri }} /> */
  url: string;
  /** Ruta del archivo en el bucket "publicaciones" */
  ruta: string | null;
  /** 1 = portada */
  orden: number;
};

export type Publicacion = {
  id: string;
  usuario_id: string;
  tipo: TipoPublicacion;
  titulo: string;
  descripcion: string;
  precio: number;
  unidad_precio: UnidadPrecio;
  latitud: number | null;
  longitud: number | null;
  disponibilidad: Disponibilidad;
  estado_moderacion: EstadoModeracion;
  /** Publicaciones destacadas (Sprint 11) */
  destacada: boolean;
  creado_en: string;
  actualizado_en: string;
  categoria: Pick<Categoria, 'id' | 'nombre' | 'slug' | 'tipo'>;
  imagenes: ImagenPublicacion[];
};

/** Cuerpo de POST /api/publications */
export type NuevaPublicacion = {
  titulo: string;
  descripcion: string;
  precio: number;
  unidad_precio?: UnidadPrecio;
  categoria_id: number;
  /** Rutas dentro del bucket "publicaciones": "<id del usuario>/<archivo>.jpg" */
  imagenes: string[];
  latitud?: number | null;
  longitud?: number | null;
};

export type CampoPublicacion =
  | 'cuerpo'
  | 'titulo'
  | 'descripcion'
  | 'precio'
  | 'unidad_precio'
  | 'categoria_id'
  | 'imagenes'
  | 'ubicacion';

export type ErroresPublicacion = Partial<Record<CampoPublicacion, string>>;

export type CodigoError =
  | 'VALIDACION'
  | 'NO_AUTENTICADO'
  | 'SIN_PERMISO'
  | 'PERFIL_INCOMPLETO'
  | 'LIMITE_ALCANZADO'
  | 'NO_ENCONTRADO'
  | 'ERROR_INTERNO';

/** Forma de todas las respuestas de error de la API */
export type RespuestaError = {
  error: {
    codigo: CodigoError;
    mensaje: string;
    campos?: ErroresPublicacion;
  };
};