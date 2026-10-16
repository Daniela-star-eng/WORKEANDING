// src/app/(auth)/registro-cliente.tsx — Ruta /registro-cliente ("Crea tu cuenta")
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AuthFooter,
  AuthHeader,
  PasswordField,
  PrimaryButton,
  TextField,
} from '@/components/auth/AuthComponents';
import CuentaCreada from '@/components/auth/CuentaCreada';
import { CheckboxRow, FormHeader } from '@/components/auth/FormComponents';
import { styles } from '@/components/auth/styles';
import { PASSWORD_MIN } from '@/services/auth';
import { registrarCliente, validarCliente, type ErroresRegistro } from '@/services/registro';

export default function RegistroClienteScreen() {
  const router = useRouter();

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [colonia, setColonia] = useState('');
  const [password, setPassword] = useState('');
  const [terminos, setTerminos] = useState(false);

  const [errores, setErrores] = useState<ErroresRegistro>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [confirmarCorreo, setConfirmarCorreo] = useState(false);

  async function manejarRegistro() {
    const datos = { nombre, email, telefono, colonia, password, terminos };
    const erroresValidacion = validarCliente(datos);
    setErrores(erroresValidacion);
    setErrorGeneral(null);
    if (Object.keys(erroresValidacion).length > 0) return;

    setCargando(true);
    const { error, requiereConfirmacion } = await registrarCliente(datos);
    setCargando(false);

    if (error) {
      setErrorGeneral(error);
      return;
    }
    if (requiereConfirmacion) setConfirmarCorreo(true);
    // Si no requiere confirmación, Supabase ya abrió la sesión y el layout
    // raíz manda automáticamente al inicio.
  }

  if (confirmarCorreo) return <CuentaCreada email={email} />;

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <FormHeader onBack={() => router.back()} showLogo />

          <AuthHeader
            title="Crea tu cuenta"
            subtitle="Únete a la mayor red de profesionales de confianza."
          />

          <TextField
            label="NOMBRE COMPLETO"
            error={errores.nombre}
            placeholder="Mateo Silva"
            autoComplete="name"
            textContentType="name"
            value={nombre}
            onChangeText={setNombre}
          />

          <TextField
            label="CORREO ELECTRÓNICO"
            error={errores.email}
            placeholder="mateo@ejemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
          />

          <TextField
            label="TELÉFONO"
            error={errores.telefono}
            placeholder="442 123 4567"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            value={telefono}
            onChangeText={setTelefono}
          />

          <TextField
            label="COLONIA / ZONA"
            error={errores.colonia}
            placeholder="Centro, Querétaro"
            value={colonia}
            onChangeText={setColonia}
          />

          <PasswordField
            label="CONTRASEÑA"
            error={errores.password}
            placeholder={`Mínimo ${PASSWORD_MIN} caracteres`}
            autoComplete="new-password"
            textContentType="newPassword"
            value={password}
            onChangeText={setPassword}
          />

          <CheckboxRow
            checked={terminos}
            onToggle={() => setTerminos((v) => !v)}
            text="Acepto los términos y condiciones de privacidad."
            error={errores.terminos}
          />

          {errorGeneral ? <Text style={styles.errorGeneral}>{errorGeneral}</Text> : null}

          <PrimaryButton label="Crear Cuenta" onPress={manejarRegistro} cargando={cargando} />

          <AuthFooter
            text="¿Ya tienes cuenta?"
            linkText="Inicia Sesión"
            onPress={() => router.replace('/login')}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
