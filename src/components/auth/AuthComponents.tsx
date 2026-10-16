// src/components/auth/AuthComponents.tsx — Piezas reutilizables (campos, botones, encabezados)
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';

import { colors, styles } from './styles';

export type SocialProvider = 'google' | 'apple';

export const AuthHeader = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.subtitle}>{subtitle}</Text>
  </>
);

export const Field = ({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <View style={styles.fieldSpacing}>
    <Text style={styles.label}>{label}</Text>
    <View style={[styles.inputWrapper, error ? styles.inputWrapperError : null]}>
      {children}
    </View>
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
  </View>
);

export const TextField = ({
  label,
  error,
  ...inputProps
}: { label: string; error?: string } & TextInputProps) => (
  <Field label={label} error={error}>
    <TextInput
      style={styles.input}
      placeholderTextColor={colors.placeholder}
      {...inputProps}
    />
  </Field>
);

export const PasswordField = ({
  label,
  error,
  ...inputProps
}: { label: string; error?: string } & TextInputProps) => {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} error={error}>
      <TextInput
        style={styles.input}
        placeholder="••••••••"
        placeholderTextColor={colors.placeholder}
        secureTextEntry={!visible}
        {...inputProps}
      />
      <TouchableOpacity
        onPress={() => setVisible((v) => !v)}
        accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
        <Ionicons
          name={visible ? 'eye-off-outline' : 'eye-outline'}
          size={22}
          color={colors.icon}
        />
      </TouchableOpacity>
    </Field>
  );
};

export const PrimaryButton = ({
  label,
  onPress,
  cargando = false,
}: {
  label: string;
  onPress: () => void;
  cargando?: boolean;
}) => (
  <TouchableOpacity
    style={[styles.primaryButton, cargando && styles.primaryButtonDisabled]}
    onPress={onPress}
    disabled={cargando}
    accessibilityRole="button">
    {cargando ? (
      <ActivityIndicator color={colors.white} />
    ) : (
      <Text style={styles.primaryButtonText}>{label}</Text>
    )}
  </TouchableOpacity>
);

export const SecondaryButton = ({
  label,
  onPress,
  cargando = false,
}: {
  label: string;
  onPress: () => void;
  cargando?: boolean;
}) => (
  <TouchableOpacity
    style={[styles.secondaryButton, cargando && styles.primaryButtonDisabled]}
    onPress={onPress}
    disabled={cargando}
    accessibilityRole="button">
    {cargando ? (
      <ActivityIndicator color={colors.title} />
    ) : (
      <Text style={styles.secondaryButtonText}>{label}</Text>
    )}
  </TouchableOpacity>
);

export const Divider = ({ text }: { text: string }) => (
  <View style={styles.dividerRow}>
    <View style={styles.dividerLine} />
    <Text style={styles.dividerText}>{text}</Text>
    <View style={styles.dividerLine} />
  </View>
);

const SocialButton = ({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.socialButton} onPress={onPress}>
    <Ionicons name={icon} size={20} color={colors.icon} />
    <Text style={styles.socialText}>{label}</Text>
  </TouchableOpacity>
);

export const SocialButtons = ({
  onPress,
}: {
  onPress: (provider: SocialProvider) => void;
}) => (
  <View style={styles.socialRow}>
    <SocialButton icon="logo-google" label="Google" onPress={() => onPress('google')} />
    <SocialButton icon="logo-apple" label="Apple" onPress={() => onPress('apple')} />
  </View>
);

export const AuthFooter = ({
  text,
  linkText,
  onPress,
}: {
  text: string;
  linkText: string;
  onPress: () => void;
}) => (
  <View style={styles.footer}>
    <Text style={styles.footerText}>{text}</Text>
    <TouchableOpacity onPress={onPress}>
      <Text style={styles.footerLink}>{linkText}</Text>
    </TouchableOpacity>
  </View>
);
