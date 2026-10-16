import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';

import { supabase } from '@/lib/supabase';
import { obtenerPerfil, type Usuario } from '@/services/auth';

type AuthContextValue = {
  session: Session | null;
  perfil: Usuario | null;
  cargando: boolean;
  recargarPerfil: () => Promise<void>;
  /** Reemplaza el perfil en memoria (p. ej. con el que regresa actualizarPerfil). */
  setPerfil: (perfil: Usuario) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  // Sesión guardada + cambios de sesión (login, logout, token renovado)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCargando(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSession(nuevaSesion);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  // Cargar el perfil de public.usuarios cuando cambia el usuario
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) {
      setPerfil(null);
      return;
    }
    obtenerPerfil(userId).then(setPerfil);
  }, [userId]);

  async function recargarPerfil() {
    if (userId) setPerfil(await obtenerPerfil(userId));
  }

  return (
    <AuthContext.Provider value={{ session, perfil, cargando, recargarPerfil, setPerfil }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return contexto;
}
