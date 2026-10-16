// src/app/(auth)/registro.tsx — Ruta /registro: "¿Cómo quieres usar Workeando?"
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthFooter, PrimaryButton } from '@/components/auth/AuthComponents';
import { formStyles as fs } from '@/components/auth/formStyles';
import { FormHeader } from '@/components/auth/FormComponents';
import { colors, styles } from '@/components/auth/styles';
import type { TipoUsuario } from '@/services/auth';

const RoleCard = ({
  activo,
  icon,
  titulo,
  descripcion,
  onPress,
}: {
  activo: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  titulo: string;
  descripcion: string;
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={[fs.roleCard, activo && fs.roleCardActive]}
    onPress={onPress}
    activeOpacity={0.9}
    accessibilityRole="radio"
    accessibilityState={{ selected: activo }}>
    <View style={[fs.roleIcon, activo && fs.roleIconActive]}>
      <Ionicons name={icon} size={22} color={activo ? colors.primary : colors.icon} />
    </View>
    {activo ? (
      <Ionicons name="checkmark-circle" size={26} color={colors.primary} style={fs.roleCheck} />
    ) : null}
    <Text style={fs.roleTitle}>{titulo}</Text>
    <Text style={fs.roleDesc}>{descripcion}</Text>
  </TouchableOpacity>
);

export default function ElegirTipoScreen() {
  const router = useRouter();
  const [tipo, setTipo] = useState<TipoUsuario>('CLIENTE');

  function continuar() {
    router.push(tipo === 'CLIENTE' ? '/registro-cliente' : '/registro-prestador');
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={fs.roleScreen}>
        <FormHeader onBack={() => (router.canGoBack() ? router.back() : router.replace('/login'))} />

        <Text style={styles.title}>¿Cómo quieres usar Workeando?</Text>
        <Text style={styles.subtitle}>
          Elige el tipo de perfil que mejor se adapte a tus necesidades hoy. Podrás cambiarlo
          después desde tu perfil.
        </Text>

        <RoleCard
          activo={tipo === 'CLIENTE'}
          icon="search"
          titulo="Busco servicios"
          descripcion="Renta plomeros, electricistas y más cerca de ti"
          onPress={() => setTipo('CLIENTE')}
        />
        <RoleCard
          activo={tipo === 'PRESTADOR'}
          icon="briefcase-outline"
          titulo="Ofrezco servicios"
          descripcion="Pon en renta tus servicios y haz crecer tu negocio"
          onPress={() => setTipo('PRESTADOR')}
        />

        <View style={{ flex: 1 }} />
        <PrimaryButton label="Continuar" onPress={continuar} />
        <AuthFooter
          text="¿Ya tienes cuenta?"
          linkText="Inicia Sesión"
          onPress={() => router.replace('/login')}
        />
      </View>
    </SafeAreaView>
  );
}
