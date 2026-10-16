// src/components/auth/CuentaCreada.tsx — Pantalla "Revisa tu correo" tras registrarse
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from './AuthComponents';
import { formStyles as fs } from './formStyles';
import { colors, styles } from './styles';

export default function CuentaCreada({ email, aviso }: { email: string; aviso?: string }) {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={fs.dashWrap}>
        <Ionicons name="mail-unread-outline" size={56} color={colors.primary} />
        <Text style={[styles.title, { textAlign: 'center' }]}>¡Cuenta creada!</Text>
        <Text style={[styles.subtitle, { textAlign: 'center' }]}>
          Te enviamos un correo a {email.trim()}. Confírmalo y después inicia sesión.
          {aviso ? `\n\n${aviso}` : ''}
        </Text>
        <View style={fs.dashButtonWrap}>
          <PrimaryButton label="Ir a iniciar sesión" onPress={() => router.replace('/login')} />
        </View>
      </View>
    </SafeAreaView>
  );
}
