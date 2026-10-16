// src/app/(tabs)/perfil.tsx — Editar perfil (Sprint 3 · PB04 / HU01)
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AuthHeader,
  Field,
  PrimaryButton,
  SecondaryButton,
  TextField,
} from '@/components/auth/AuthComponents';
import { avisar } from '@/components/auth/avisar';
import { formStyles as fs } from '@/components/auth/formStyles';
import { elegirImagen } from '@/components/auth/FormComponents';
import { colors, styles } from '@/components/auth/styles';
import { BottomTabInset } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { cerrarSesion, type TipoUsuario, type Usuario } from '@/services/auth';
import {
  actualizarPerfil,
  subirFotoPerfil,
  validarPerfil,
  type CambiosPerfil,
  type ErroresPerfil,
} from '@/services/perfil';
import { subirIdentificacion } from '@/services/registro';

const TIPOS: { valor: TipoUsuario; titulo: string }[] = [
  { valor: 'CLIENTE', titulo: 'Busco servicios' },
  { valor: 'PRESTADOR', titulo: 'Ofrezco servicios' },
];

/** Solo los campos que cambiaron respecto al perfil guardado. */
function calcularCambios(
  perfil: Usuario,
  form: { nombre: string; telefono: string; fecha: string; tipo: TipoUsuario }
): CambiosPerfil {
  const cambios: CambiosPerfil = {};
  if (form.nombre.trim() !== perfil.nombre) cambios.nombre = form.nombre;
  if (form.telefono.trim() !== (perfil.telefono ?? '')) cambios.telefono = form.telefono.trim() || null;
  if (form.fecha.trim() !== (perfil.fecha_nacimiento ?? '')) {
    cambios.fecha_nacimiento = form.fecha.trim() || null;
  }
  if (form.tipo !== perfil.tipo_usuario) cambios.tipo_usuario = form.tipo;
  return cambios;
}

export default function PerfilScreen() {
  const { perfil, setPerfil } = useAuth();

  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [fecha, setFecha] = useState('');
  const [tipo, setTipo] = useState<TipoUsuario>('CLIENTE');

  const [errores, setErrores] = useState<ErroresPerfil>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [subiendoId, setSubiendoId] = useState(false);

  // Llenar el formulario cuando llega (o cambia) el perfil guardado
  useEffect(() => {
    if (!perfil) return;
    setNombre(perfil.nombre);
    setTelefono(perfil.telefono ?? '');
    setFecha(perfil.fecha_nacimiento ?? '');
    setTipo(perfil.tipo_usuario ?? 'CLIENTE');
  }, [perfil]);

  if (!perfil) {
    return (
      <SafeAreaView style={[styles.screen, fs.dashWrap]}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  async function guardar() {
    if (!perfil) return;
    setErrorGeneral(null);
    setMensajeExito(null);

    const cambios = calcularCambios(perfil, { nombre, telefono, fecha, tipo });
    const erroresValidacion = validarPerfil(cambios);
    setErrores(erroresValidacion);
    if (Object.keys(erroresValidacion).length > 0) return;
    if (Object.keys(cambios).length === 0) {
      setMensajeExito('No hay cambios que guardar.');
      return;
    }

    setGuardando(true);
    const resultado = await actualizarPerfil(perfil.id, cambios);
    setGuardando(false);

    if (resultado.error) {
      if (resultado.campo) setErrores({ [resultado.campo]: resultado.error });
      else setErrorGeneral(resultado.error);
      return;
    }
    if (resultado.perfil) setPerfil(resultado.perfil);
    setMensajeExito('Tu perfil se guardó correctamente.');
  }

  async function cambiarFoto() {
    if (!perfil) return;
    const imagen = await elegirImagen('Foto de perfil', { allowsEditing: true, aspect: [1, 1] });
    if (!imagen) return;

    setSubiendoFoto(true);
    setErrorGeneral(null);
    const resultado = await subirFotoPerfil(perfil.id, imagen.uri, imagen.mimeType ?? 'image/jpeg');
    setSubiendoFoto(false);

    if (resultado.error) setErrorGeneral(resultado.error);
    else if (resultado.perfil) setPerfil(resultado.perfil);
  }

  async function cambiarIdentificacion() {
    if (!perfil) return;
    const imagen = await elegirImagen('Identificación oficial');
    if (!imagen) return;

    setSubiendoId(true);
    const ok = await subirIdentificacion(perfil.id, imagen.uri);
    setSubiendoId(false);
    avisar(
      ok ? 'Listo' : 'Error',
      ok ? 'Tu identificación se subió correctamente.' : 'No pudimos subir la foto. Inténtalo de nuevo.'
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingTop: Platform.OS === 'web' ? 96 : 20, paddingBottom: BottomTabInset + 32 },
          ]}
          keyboardShouldPersistTaps="handled">
          <AuthHeader title="Mi perfil" subtitle="Mantén tus datos de contacto al día." />

          {/* Foto de perfil */}
          <TouchableOpacity
            style={fs.avatarWrap}
            onPress={cambiarFoto}
            disabled={subiendoFoto}
            accessibilityLabel="Cambiar foto de perfil">
            <View style={fs.avatar}>
              {subiendoFoto ? (
                <ActivityIndicator color={colors.primary} />
              ) : perfil.foto_url ? (
                <Image source={{ uri: perfil.foto_url }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Text style={fs.avatarInitial}>{perfil.nombre.charAt(0).toUpperCase()}</Text>
              )}
            </View>
            <View style={fs.avatarBadge}>
              <Ionicons name="camera" size={16} color={colors.white} />
            </View>
          </TouchableOpacity>

          <TextField
            label="NOMBRE COMPLETO"
            error={errores.nombre}
            autoComplete="name"
            textContentType="name"
            value={nombre}
            onChangeText={setNombre}
          />

          <Field label="CORREO ELECTRÓNICO">
            <Text style={fs.readonlyValue}>{perfil.email}</Text>
            <Ionicons name="lock-closed-outline" size={16} color={colors.placeholder} />
          </Field>

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
            label="FECHA DE NACIMIENTO"
            error={errores.fecha_nacimiento}
            placeholder="AAAA-MM-DD"
            keyboardType="numbers-and-punctuation"
            value={fecha}
            onChangeText={setFecha}
          />

          <View style={styles.fieldSpacing}>
            <Text style={styles.label}>¿CÓMO USAS WORKEANDO?</Text>
            <View style={fs.segmentRow}>
              {TIPOS.map((t) => {
                const activo = t.valor === tipo;
                return (
                  <TouchableOpacity
                    key={t.valor}
                    style={[fs.segment, activo && fs.segmentActive]}
                    onPress={() => setTipo(t.valor)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: activo }}>
                    <Text style={[fs.segmentText, activo && fs.segmentTextActive]}>{t.titulo}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {errores.tipo_usuario ? (
              <Text style={styles.errorText}>{errores.tipo_usuario}</Text>
            ) : null}
          </View>

          {errorGeneral ? <Text style={styles.errorGeneral}>{errorGeneral}</Text> : null}
          {mensajeExito ? <Text style={styles.successGeneral}>{mensajeExito}</Text> : null}

          <PrimaryButton label="Guardar cambios" onPress={guardar} cargando={guardando} />

          {perfil.tipo_usuario === 'PRESTADOR' ? (
            <>
              <View style={fs.sectionGap} />
              <SecondaryButton
                label="Subir / cambiar identificación oficial"
                onPress={cambiarIdentificacion}
                cargando={subiendoId}
              />
            </>
          ) : null}

          <View style={fs.sectionGap} />
          <SecondaryButton label="Cerrar sesión" onPress={cerrarSesion} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
