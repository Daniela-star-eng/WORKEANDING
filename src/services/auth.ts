import { isAuthRetryableFetchError, type AuthError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

// =====================================================================
// Autenticación: inicio/cierre de sesión y lectura del perfil.
// El registro de clientes y prestadores está en services/registro.ts.
// =====================================================================

export type TipoUsuario = 'CLIENTE' | 'PRESTADOR';

export type Usuario = {
  id: string;
  email: string;
  nombre: string;
  tipo_usuario: TipoUsuario | null;
  fecha_nacimiento: string | null;
  latitud: number | null;
  longitud: number | null;
  estado_cuenta: string;
  es_admin: boolean;
  // Sprint 3 (supabase/sprint3_perfil.sql)
  telefono: string | null;
  foto_url: string | null;
  actualizado_en: string;
};

export type ErroresCampos = Partial<Record<'email' | 'password', string>>;

export const PASSWORD_MIN = 8;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- Validaciones (antes de llamar a Supabase) ----------

export function validarEmail(email: string): string | undefined {
  const correo = email.trim();
  if (!correo) return 'Ingresa tu correo electrónico.';
  if (!EMAIL_REGEX.test(correo)) return 'Ingresa un correo válido.';
  return undefined;
}

export function validarLogin(email: string, password: string): ErroresCampos {
  const errores: ErroresCampos = {};
  const errorEmail = validarEmail(email);
  if (errorEmail) errores.email = errorEmail;
  if (!password) errores.password = 'Ingresa tu contraseña.';
  return errores;
}

// ---------- Operaciones ----------

export async function iniciarSesion(
  email: string,
  password: string
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) return { error: traducirError(error) };

  const perfil = await obtenerPerfil(data.user.id);
  if (perfil && perfil.estado_cuenta !== 'ACTIVA') {
    await supabase.auth.signOut();
    return { error: 'Tu cuenta no está activa. Contacta a soporte.' };
  }

  // No hay que navegar: el layout raíz detecta la sesión y abre la app.
  return { error: null };
}

export async function cerrarSesion(): Promise<void> {
  await supabase.auth.signOut();
}

export async function obtenerPerfil(id: string): Promise<Usuario | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.warn('No se pudo cargar el perfil:', error.message);
    return null;
  }
  return data as Usuario | null;
}

// ---------- Mensajes de error en español ----------

export function traducirError(error: AuthError): string {
  switch (error.code) {
    case 'invalid_credentials':
      return 'Correo o contraseña incorrectos.';
    case 'email_not_confirmed':
      return 'Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.';
    case 'user_already_exists':
    case 'email_exists':
      return 'Ya existe una cuenta con este correo.';
    case 'weak_password':
      return `La contraseña es muy débil. Usa al menos ${PASSWORD_MIN} caracteres.`;
    case 'email_address_invalid':
      return 'El correo no es válido.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
    case 'signup_disabled':
      return 'El registro está deshabilitado por el momento.';
  }
  if (isAuthRetryableFetchError(error)) {
    return 'No hay conexión con el servidor. Revisa tu internet.';
  }
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}
