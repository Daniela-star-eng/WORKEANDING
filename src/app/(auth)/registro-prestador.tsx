// src/app/(auth)/registro-prestador.tsx — Ruta /registro-prestador
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
import { avisar } from '@/components/auth/avisar';
import CuentaCreada from '@/components/auth/CuentaCreada';
import {
  CheckboxRow,
  FormHeader,
  ImageUploadField,
  SelectField,
  TextAreaField,
  ToggleRow,
} from '@/components/auth/FormComponents';
import { styles } from '@/components/auth/styles';
import { PASSWORD_MIN } from '@/services/auth';
import {
  CATEGORIAS,
  registrarPrestador,
  validarPrestador,
  type ErroresRegistro,
} from '@/services/registro';

export default function RegistroPrestadorScreen() {
  const router = useRouter();

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [experiencia, setExperiencia] = useState('');
  const [herramientasPropias, setHerramientasPropias] = useState(true);
  const [password, setPassword] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [terminos, setTerminos] = useState(false);

  const [errores, setErrores] = useState<ErroresRegistro>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [confirmarCorreo, setConfirmarCorreo] = useState<{ aviso?: string } | null>(null);

  async function manejarRegistro() {
    const datos = {
      nombre,
      email,
      telefono,
      categoria,
      experiencia,
      herramientasPropias,
      password,
      foto,
      terminos,
    };
    const erroresValidacion = validarPrestador(datos);
    setErrores(erroresValidacion);
    setErrorGeneral(null);
    if (Object.keys(erroresValidacion).length > 0) return;

    setCargando(true);
    const { error, requiereConfirmacion, aviso } = await registrarPrestador(datos);
    setCargando(false);

    if (error) {
      setErrorGeneral(error);
      return;
    }

    if (requiereConfirmacion) {
      setConfirmarCorreo({ aviso });
      return;
    }

    // Ya hay sesión: el layout raíz manda al inicio.
    if (aviso) avisar('Aviso', aviso);
  }

  if (confirmarCorreo) return <CuentaCreada email={email} aviso={confirmarCorreo.aviso} />;

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <FormHeader onBack={() => router.back()} />

          <AuthHeader
            title="Regístrate como prestador"
            subtitle="Pon en renta tus servicios y recibe ofertas de clientes en tu zona."
          />

          <TextField
            label="NOMBRE COMPLETO"
            error={errores.nombre}
            placeholder="Sofía Rossi"
            autoComplete="name"
            textContentType="name"
            value={nombre}
            onChangeText={setNombre}
          />

          <TextField
            label="CORREO ELECTRÓNICO"
            error={errores.email}
            placeholder="sofia@ejemplo.com"
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

          <SelectField
            label="CATEGORÍA PRINCIPAL"
            error={errores.categoria}
            value={categoria}
            options={CATEGORIAS}
            onChange={setCategoria}
          />

          <TextAreaField
            label="DESCRIBE TU EXPERIENCIA"
            error={errores.experiencia}
            placeholder="Tengo más de 5 años realizando servicios de..."
            value={experiencia}
            onChangeText={setExperiencia}
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

          <ToggleRow
            title="Tengo herramientas propias"
            hint="Para realizar de manera autónoma los trabajos."
            value={herramientasPropias}
            onValueChange={setHerramientasPropias}
          />

          <ImageUploadField
            label="CREDENCIALES O IDENTIFICACIÓN (FOTO)"
            text="Subir foto de identificación oficial"
            uri={foto}
            error={errores.foto}
            onChange={setFoto}
          />

          <CheckboxRow
            checked={terminos}
            onToggle={() => setTerminos((v) => !v)}
            text="Acepto el contrato de prestador de servicios independientes."
            error={errores.terminos}
          />

          {errorGeneral ? <Text style={styles.errorGeneral}>{errorGeneral}</Text> : null}

          <PrimaryButton
            label="Crear Cuenta de Prestador"
            onPress={manejarRegistro}
            cargando={cargando}
          />

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
