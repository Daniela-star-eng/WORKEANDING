import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/providers/auth-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AuthProvider>
      <NavegacionRaiz />
    </AuthProvider>
  );
}

function NavegacionRaiz() {
  const colorScheme = useColorScheme();
  const { session, cargando } = useAuth();

  // Mientras se lee la sesión guardada se mantiene el splash
  if (cargando) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        {/* Con sesión: la app (Inicio y Perfil) y la edición de publicaciones */}
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="publicacion/[id]/editar" />
        </Stack.Protected>

        {/* Sin sesión: login y registro */}
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}