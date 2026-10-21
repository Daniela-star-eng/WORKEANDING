// src/server/supabase.ts — Cliente de Supabase para las rutas de API (solo servidor)
//
// Se crea un cliente por petición con el token del usuario que llama a la API.
// Así la base de datos aplica sus reglas (RLS) como si fuera ese usuario:
// la API no necesita la llave secreta (service_role) para nada.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function configuracion() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const llave = process.env.EXPO_PUBLIC_SUPABASE_KEY;
  if (!url || !llave) {
    throw new Error('Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_KEY en el servidor.');
  }
  return { url, llave };
}

export function clienteSupabase(token?: string | null): SupabaseClient {
  const { url, llave } = configuracion();
  return createClient(url, llave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  });
}

/** URL pública de un bucket público de Storage (termina en "/"); se le concatena la ruta del archivo. */
export function urlBaseBucket(bucket: string): string {
  const { url } = configuracion();
  return `${url.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/`;
}