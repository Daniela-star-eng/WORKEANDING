import { supabase } from '@/lib/supabase';
import {
  PASSWORD_MIN,
  traducirError,
  validarEmail,
  type TipoUsuario,
} from '@/services/auth';
import { limpiarTelefono, subirFotoPerfil, TELEFONO_REGEX } from '@/services/perfil';

// =====================================================================
// Registro de clientes y prestadores (sin UI).
// Todo lo que va en options.data lo lee el trigger crear_perfil_usuario
// (supabase/auth_usuarios.sql + sprint3_perfil.sql) para llenar
// public.usuarios y, si es prestador, public.prestadores.
// =====================================================================

export type ErroresRegistro = Partial<
  Record<
    | 'nombre'
    | 'email'
    | 'telefono'
    | 'colonia'
    | 'password'
    | 'categoria'
    | 'experiencia'
    | 'foto'
    | 'fotoPerfil'
    | 'terminos',
    string
  >
>;

export type DatosCliente = {
  nombre: string;
  email: string;
  telefono: string;
  colonia: string;
  password: string;
  terminos: boolean;
};

export type DatosPrestador = {
  nombre: string;
  email: string;
  telefono: string;
  categoria: string;
  experiencia: string;
  herramientasPropias: boolean;
  password: string;
  /** Foto de la identificación oficial (bucket privado) */
  foto: string | null;
  /** Foto de perfil pública (bucket avatares), obligatoria para prestadores */
  fotoPerfil: { uri: string; mimeType?: string } | null;
  terminos: boolean;
};

export type ResultadoRegistro = {
  error: string | null;
  requiereConfirmacion: boolean;
  aviso?: string;
};

export const CATEGORIAS = [
  'Plomería, Grifería y Gas',
  'Electricidad',
  'Carpintería',
  'Pintura',
  'Albañilería',
  'Cerrajería',
  'Aire acondicionado',
  'Limpieza',
  'Jardinería',
];

const TIPOS_FOTO_PERFIL = ['image/jpeg', 'image/png', 'image/webp'];

// ---------- Validaciones ----------

function validarComunes(d: {
  nombre: string;
  email: string;
  telefono: string;
  password: string;
  terminos: boolean;
}): ErroresRegistro {
  const e: ErroresRegistro = {};

  if (d.nombre.trim().length < 2) e.nombre = 'Ingresa tu nombre completo.';

  const errorEmail = validarEmail(d.email);
  if (errorEmail) e.email = errorEmail;

  if (!d.telefono.trim()) e.telefono = 'Ingresa tu teléfono.';
  else if (!TELEFONO_REGEX.test(limpiarTelefono(d.telefono))) {
    e.telefono = 'El teléfono debe tener entre 10 y 15 dígitos.';
  }

  if (!d.password) e.password = 'Crea una contraseña.';
  else if (d.password.length < PASSWORD_MIN) {
    e.password = `Debe tener al menos ${PASSWORD_MIN} caracteres.`;
  }

  if (!d.terminos) e.terminos = 'Debes aceptar para continuar.';

  return e;
}

export function validarCliente(d: DatosCliente): ErroresRegistro {
  const e = validarComunes(d);
  if (!d.colonia.trim()) e.colonia = 'Ingresa tu colonia o zona.';
  return e;
}

export function validarPrestador(d: DatosPrestador): ErroresRegistro {
  const e = validarComunes(d);
  if (!d.categoria) e.categoria = 'Selecciona una categoría.';
  if (d.experiencia.trim().length < 10) {
    e.experiencia = 'Cuéntanos un poco más de tu experiencia.';
  }
  if (!d.foto) e.foto = 'Sube una foto de tu identificación.';
  if (!d.fotoPerfil) e.fotoPerfil = 'Agrega tu foto de perfil.';
  else if (d.fotoPerfil.mimeType && !TIPOS_FOTO_PERFIL.includes(d.fotoPerfil.mimeType)) {
    e.fotoPerfil = 'La foto debe ser JPG, PNG o WEBP.';
  }
  return e;
}

// ---------- Registro ----------

async function crearCuenta(
  email: string,
  password: string,
  datos: { nombre: string; tipo_usuario: TipoUsuario } & Record<string, unknown>
) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: datos },
  });

  if (error) return { data: null, error: traducirError(error) };

  // Con "Confirm email" activo, Supabase no marca error si el correo ya existe:
  // regresa un usuario sin identidades.
  if (data.user && data.user.identities?.length === 0) {
    return { data: null, error: 'Ya existe una cuenta con este correo.' };
  }
  return { data, error: null };
}

export async function registrarCliente(d: DatosCliente): Promise<ResultadoRegistro> {
  const { data, error } = await crearCuenta(d.email, d.password, {
    nombre: d.nombre.trim(),
    tipo_usuario: 'CLIENTE',
    telefono: limpiarTelefono(d.telefono),
    colonia: d.colonia.trim(),
  });

  if (error || !data) return { error, requiereConfirmacion: false };
  return { error: null, requiereConfirmacion: !data.session };
}

export async function registrarPrestador(d: DatosPrestador): Promise<ResultadoRegistro> {
  const { data, error } = await crearCuenta(d.email, d.password, {
    nombre: d.nombre.trim(),
    tipo_usuario: 'PRESTADOR',
    telefono: limpiarTelefono(d.telefono),
    categoria: d.categoria,
    experiencia: d.experiencia.trim(),
    herramientas_propias: d.herramientasPropias,
  });

  if (error || !data) return { error, requiereConfirmacion: false };

  // Sin sesión (correo por confirmar) todavía no se pueden subir las fotos:
  // al iniciar sesión, Inicio le pide la foto de perfil al prestador.
  if (!data.session || !data.user) {
    return {
      error: null,
      requiereConfirmacion: true,
      aviso: 'Cuando confirmes tu correo e inicies sesión, sube tu foto de perfil y tu identificación desde tu perfil.',
    };
  }

  const idUsuario = data.user.id;
  const [perfil, identificacion] = await Promise.all([
    subirFotoPerfil(idUsuario, d.fotoPerfil!.uri, d.fotoPerfil!.mimeType ?? 'image/jpeg'),
    subirIdentificacion(idUsuario, d.foto!),
  ]);

  const fallas = [
    perfil.error ? 'tu foto de perfil' : null,
    identificacion ? null : 'tu identificación',
  ].filter(Boolean);

  return {
    error: null,
    requiereConfirmacion: false,
    aviso: fallas.length
      ? `Tu cuenta se creó, pero no pudimos subir ${fallas.join(' ni ')}. Inténtalo desde tu perfil.`
      : undefined,
  };
}

// ---------- Foto de identificación (bucket privado "identificaciones") ----------

export async function subirIdentificacion(idUsuario: string, uri: string): Promise<boolean> {
  try {
    const extension = (uri.split('.').pop() ?? 'jpg').split('?')[0].toLowerCase();
    const ext = ['png', 'webp', 'jpg', 'jpeg'].includes(extension) ? extension : 'jpg';
    const ruta = `${idUsuario}/identificacion.${ext}`;
    const archivo = await (await fetch(uri)).arrayBuffer();

    const { error } = await supabase.storage.from('identificaciones').upload(ruta, archivo, {
      contentType: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg',
      upsert: true,
    });
    if (error) {
      console.warn('Error al subir identificación:', error.message);
      return false;
    }

    const { error: errorRuta } = await supabase
      .from('prestadores')
      .update({ identificacion_path: ruta })
      .eq('usuario_id', idUsuario);
    if (errorRuta) console.warn('No se guardó la ruta de la identificación:', errorRuta.message);

    return true;
  } catch {
    return false;
  }
}