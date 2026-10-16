// src/components/auth/LoginLayout.tsx — Arquitectura visual del login (solo UI)
import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity } from 'react-native';

import type { ErroresCampos } from '@/services/auth';
import {
  AuthFooter,
  AuthHeader,
  Divider,
  PasswordField,
  PrimaryButton,
  SocialButtons,
  TextField,
  type SocialProvider,
} from './AuthComponents';
import { styles } from './styles';

type Props = {
  email: string;
  password: string;
  onChangeEmail: (value: string) => void;
  onChangePassword: (value: string) => void;
  errores?: ErroresCampos;
  errorGeneral?: string | null;
  cargando?: boolean;
  onLogin: () => void;
  onForgotPassword: () => void;
  onSocialLogin: (provider: SocialProvider) => void;
  onGoToRegister: () => void;
};

export default function LoginLayout({
  email,
  password,
  onChangeEmail,
  onChangePassword,
  errores = {},
  errorGeneral,
  cargando = false,
  onLogin,
  onForgotPassword,
  onSocialLogin,
  onGoToRegister,
}: Props) {
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <AuthHeader
          title="Bienvenido de vuelta"
          subtitle="Ingresa tus datos para rentar o publicar servicios"
        />

        <TextField
          label="CORREO ELECTRÓNICO"
          error={errores.email}
          placeholder="ejemplo@correo.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          value={email}
          onChangeText={onChangeEmail}
        />

        <PasswordField
          label="CONTRASEÑA"
          error={errores.password}
          autoComplete="current-password"
          textContentType="password"
          value={password}
          onChangeText={onChangePassword}
          onSubmitEditing={onLogin}
        />

        <TouchableOpacity onPress={onForgotPassword}>
          <Text style={styles.forgot}>¿Olvidaste tu contraseña?</Text>
        </TouchableOpacity>

        {errorGeneral ? <Text style={styles.errorGeneral}>{errorGeneral}</Text> : null}

        <PrimaryButton label="Iniciar Sesión" onPress={onLogin} cargando={cargando} />

        <Divider text="O CONTINÚA CON" />
        <SocialButtons onPress={onSocialLogin} />

        <AuthFooter text="¿No tienes cuenta?" linkText="Regístrate" onPress={onGoToRegister} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
