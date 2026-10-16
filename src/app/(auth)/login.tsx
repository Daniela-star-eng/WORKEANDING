// src/app/(auth)/login.tsx — Ruta /login: conecta la lógica con la UI
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { SocialProvider } from '@/components/auth/AuthComponents';
import { avisar } from '@/components/auth/avisar';
import LoginLayout from '@/components/auth/LoginLayout';
import { styles } from '@/components/auth/styles';
import { iniciarSesion, validarLogin, type ErroresCampos } from '@/services/auth';

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errores, setErrores] = useState<ErroresCampos>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function manejarLogin() {
    const erroresValidacion = validarLogin(email, password);
    setErrores(erroresValidacion);
    setErrorGeneral(null);
    if (Object.keys(erroresValidacion).length > 0) return;

    setCargando(true);
    const { error } = await iniciarSesion(email, password);
    setCargando(false);

    if (error) {
      // HU-01: mostrar error claro SIN limpiar el correo
      setErrorGeneral(error);
      setPassword('');
    }
    // Si todo salió bien no hay que navegar: el layout raíz detecta la sesión
  }

  function manejarSocial(provider: SocialProvider) {
    avisar('Próximamente', `El acceso con ${provider === 'google' ? 'Google' : 'Apple'} aún no está disponible.`);
  }

  function manejarOlvideContrasena() {
    avisar('Próximamente', 'La recuperación de contraseña aún no está disponible.');
  }

  return (
    <SafeAreaView style={styles.screen}>
      <LoginLayout
        email={email}
        password={password}
        onChangeEmail={setEmail}
        onChangePassword={setPassword}
        errores={errores}
        errorGeneral={errorGeneral}
        cargando={cargando}
        onLogin={manejarLogin}
        onForgotPassword={manejarOlvideContrasena}
        onSocialLogin={manejarSocial}
        onGoToRegister={() => router.push('/registro')}
      />
    </SafeAreaView>
  );
}
