// src/app/(tabs)/index.tsx — Inicio (se ampliará con el catálogo de servicios en renta)
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton, SecondaryButton } from '@/components/auth/AuthComponents';
import { formStyles as fs } from '@/components/auth/formStyles';
import { styles } from '@/components/auth/styles';
import { BottomTabInset } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { cerrarSesion } from '@/services/auth';

export default function InicioScreen() {
  const router = useRouter();
  const { perfil } = useAuth();

  if (!perfil) {
    return (
      <SafeAreaView style={[styles.screen, fs.dashWrap]}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const esPrestador = perfil.tipo_usuario === 'PRESTADOR';
  const primerNombre = perfil.nombre.split(' ')[0];

  return (
    <SafeAreaView style={styles.screen}>
      <View style={[fs.dashWrap, { paddingBottom: BottomTabInset + 24 }]}>
        <Text style={fs.dashBadge}>{esPrestador ? 'PRESTADOR' : 'CLIENTE'}</Text>
        <Text style={[styles.title, { textAlign: 'center' }]}>¡Hola, {primerNombre}!</Text>
        <Text style={[styles.subtitle, { textAlign: 'center' }]}>
          {esPrestador
            ? 'Muy pronto podrás publicar tus servicios para ponerlos en renta.'
            : 'Muy pronto podrás buscar y rentar servicios cerca de ti.'}
        </Text>

        <View style={fs.dashButtonWrap}>
          <PrimaryButton label="Completar mi perfil" onPress={() => router.navigate('/perfil')} />
          <View style={fs.sectionGap} />
          <SecondaryButton label="Cerrar sesión" onPress={cerrarSesion} />
        </View>
      </View>
    </SafeAreaView>
  );
}
