// src/app/publicacion/[id]/editar.tsx — Ruta /publicacion/<id>/editar (Sprint 5)
//
// Formulario de edición de una publicación. Esta pantalla trae la sección de
// FOTOGRAFÍAS (agregar, reemplazar, eliminar y elegir portada) con su propio guardado.
// Los campos de texto (título, descripción, precio...) de la tarea "Editar publicación"
// se agregan arriba de la galería, en el lugar marcado.

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthHeader, PrimaryButton, SecondaryButton } from '@/components/auth/AuthComponents';
import { formStyles as fs } from '@/components/auth/formStyles';
import { FormHeader } from '@/components/auth/FormComponents';
import { styles } from '@/components/auth/styles';
import GaleriaEditable from '@/components/publicaciones/GaleriaEditable';
import { useAuth } from '@/providers/auth-provider';
import {
  fotosDePublicacion,
  galeriaCambio,
  guardarGaleria,
  obtenerPublicacion,
  type FotoGaleria,
  type Publicacion,
} from '@/services/publicaciones';

export default function EditarPublicacionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { perfil } = useAuth();

  const [publicacion, setPublicacion] = useState<Publicacion | null>(null);
  const [fotos, setFotos] = useState<FotoGaleria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [guardando, setGuardando] = useState(false);
  const [errorFotos, setErrorFotos] = useState<string | undefined>();
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (!id) return;
    setCargando(true);
    setErrorCarga(null);
    const r = await obtenerPublicacion(id);
    setCargando(false);
    if (r.error) {
      setErrorCarga(r.error.mensaje);
      return;
    }
    setPublicacion(r.data);
    setFotos(fotosDePublicacion(r.data));
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function regresar() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  function cambiarFotos(nuevas: FotoGaleria[]) {
    setFotos(nuevas);
    setErrorFotos(undefined);
    setMensajeExito(null);
  }

  async function guardar() {
    if (!publicacion) return;
    setErrorGeneral(null);
    setErrorFotos(undefined);
    setMensajeExito(null);

    if (!galeriaCambio(publicacion, fotos)) {
      setMensajeExito('No hay cambios en las fotografías.');
      return;
    }

    setGuardando(true);
    const r = await guardarGaleria(publicacion.id, fotos);
    setGuardando(false);

    if (r.error) {
      if (r.error.campos?.imagenes) setErrorFotos(r.error.campos.imagenes);
      else setErrorGeneral(r.error.mensaje);
      return;
    }
    // Se toma lo que quedó guardado (rutas y URLs definitivas)
    setPublicacion(r.data.data);
    setFotos(fotosDePublicacion(r.data.data));
    setMensajeExito('Las fotografías se guardaron correctamente.');
  }

  function descartar() {
    if (!publicacion) return;
    setFotos(fotosDePublicacion(publicacion));
    setErrorFotos(undefined);
    setErrorGeneral(null);
    setMensajeExito(null);
  }

  // ---------- Estados de carga ----------

  if (cargando) {
    return (
      <SafeAreaView style={[styles.screen, fs.dashWrap]}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const esMia = !!publicacion && publicacion.usuario_id === perfil?.id;
  if (!publicacion || !esMia) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={fs.dashWrap}>
          <Text style={[styles.title, { textAlign: 'center' }]}>No disponible</Text>
          <Text style={[styles.subtitle, { textAlign: 'center' }]}>
            {errorCarga ?? 'Solo el autor puede editar esta publicación.'}
          </Text>
          <View style={fs.dashButtonWrap}>
            {errorCarga ? <PrimaryButton label="Reintentar" onPress={cargar} /> : null}
            <View style={fs.sectionGap} />
            <SecondaryButton label="Regresar" onPress={regresar} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const hayCambios = galeriaCambio(publicacion, fotos);

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <FormHeader onBack={regresar} />
          <AuthHeader title="Editar publicación" subtitle={publicacion.titulo} />

          {/* Aquí van los campos de texto de la tarea "Editar publicación" */}

          <GaleriaEditable
            fotos={fotos}
            onChange={cambiarFotos}
            error={errorFotos}
            deshabilitado={guardando}
          />

          {errorGeneral ? <Text style={styles.errorGeneral}>{errorGeneral}</Text> : null}
          {mensajeExito ? <Text style={styles.successGeneral}>{mensajeExito}</Text> : null}

          <PrimaryButton label="Guardar fotografías" onPress={guardar} cargando={guardando} />
          {hayCambios && !guardando ? (
            <>
              <View style={fs.sectionGap} />
              <SecondaryButton label="Descartar cambios" onPress={descartar} />
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}