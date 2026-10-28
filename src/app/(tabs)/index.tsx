// src/app/(tabs)/index.tsx — Inicio (se ampliará con el catálogo de servicios en renta)
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton, SecondaryButton } from '@/components/auth/AuthComponents';
import { formStyles as fs } from '@/components/auth/formStyles';
import { colors, styles } from '@/components/auth/styles';
import MisPublicaciones from '@/components/publicaciones/MisPublicaciones';
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
      <ScrollView
        contentContainerStyle={[fs.dashWrap, { flexGrow: 1, paddingBottom: BottomTabInset + 24 }]}>
        <Text style={fs.dashBadge}>{esPrestador ? 'PRESTADOR' : 'CLIENTE'}</Text>
        <Text style={[styles.title, { textAlign: 'center' }]}>¡Hola, {primerNombre}!</Text>
        <Text style={[styles.subtitle, { textAlign: 'center' }]}>
          {esPrestador
            ? 'Administra tus publicaciones y mantén sus fotos al día.'
            : 'Muy pronto podrás buscar y rentar servicios cerca de ti.'}
        </Text>

        {esPrestador && !perfil.foto_url ? (
          <View style={estilosAviso.tarjeta}>
            <Ionicons name="camera-outline" size={22} color={colors.primary} />
            <Text style={estilosAviso.texto}>
              Sube tu foto de perfil: es obligatoria para publicar tus servicios.
            </Text>
          </View>
        ) : null}

        {esPrestador ? <MisPublicaciones /> : null}

        <View style={fs.dashButtonWrap}>
          <PrimaryButton
            label={esPrestador && !perfil.foto_url ? 'Subir foto de perfil' : 'Completar mi perfil'}
            onPress={() => router.navigate('/perfil')}
          />
          <View style={fs.sectionGap} />
          <SecondaryButton label="Cerrar sesión" onPress={cerrarSesion} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const estilosAviso = StyleSheet.create({
  tarjeta: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C7C9F9',
    backgroundColor: colors.primarySoft,
  },
  texto: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.title },
});