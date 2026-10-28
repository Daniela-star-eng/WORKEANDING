// src/components/publicaciones/GaleriaEditable.tsx — Galería de fotos del formulario de edición (Sprint 5)
//
// Muestra las fotos de la publicación con vista previa y permite:
//   · Agregar fotos nuevas (cámara o galería; varias a la vez desde la galería)
//   · Reemplazar una foto específica
//   · Eliminar una foto específica
//   · Elegir cuál es la portada
// Solo cambia el estado del formulario: nada se sube ni se borra hasta llamar a
// guardarGaleria() de src/services/publicaciones.ts.

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, styles as base } from '@/components/auth/styles';
import { REGLAS } from '@/lib/publicaciones/tipos';
import { nuevaClave, type FotoElegida, type FotoGaleria } from '@/services/publicaciones';

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];

type Props = {
  fotos: FotoGaleria[];
  onChange: (fotos: FotoGaleria[]) => void;
  /** Error del servidor para el campo "imagenes" */
  error?: string;
  deshabilitado?: boolean;
};

// ---------------------------------------------------------------------
// Selector de imágenes
// ---------------------------------------------------------------------

/** Revisa tipo y peso antes de aceptar la foto (el bucket permite JPG/PNG/WEBP de hasta 5 MB). */
function revisarFoto(asset: ImagePicker.ImagePickerAsset): string | null {
  if (asset.mimeType && !TIPOS_PERMITIDOS.includes(asset.mimeType)) {
    return 'Las fotografías deben ser JPG, PNG o WEBP.';
  }
  if (asset.fileSize && asset.fileSize > REGLAS.IMAGEN_MAX_BYTES) {
    return 'Cada fotografía puede pesar máximo 5 MB.';
  }
  return null;
}

async function abrirSelector(origen: 'camara' | 'galeria', maximo: number) {
  const opciones: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.7,
    allowsMultipleSelection: origen === 'galeria' && maximo > 1,
    selectionLimit: maximo,
    orderedSelection: true,
  };

  if (origen === 'camara') {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert('Permiso necesario', 'Activa el acceso a la cámara para tomar la foto.');
      return [];
    }
  }

  const r =
    origen === 'camara'
      ? await ImagePicker.launchCameraAsync(opciones)
      : await ImagePicker.launchImageLibraryAsync(opciones);
  return r.canceled ? [] : r.assets.slice(0, maximo);
}

/** Pregunta cámara o galería (en web solo galería) y regresa las fotos elegidas. */
function elegirFotos(titulo: string, maximo: number): Promise<ImagePicker.ImagePickerAsset[]> {
  if (Platform.OS === 'web') return abrirSelector('galeria', maximo);
  return new Promise((resolve) => {
    Alert.alert(titulo, '¿De dónde quieres tomar la foto?', [
      { text: 'Tomar foto', onPress: () => abrirSelector('camara', 1).then(resolve) },
      { text: 'Elegir de galería', onPress: () => abrirSelector('galeria', maximo).then(resolve) },
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve([]) },
    ]);
  });
}

function aFotoNueva(asset: ImagePicker.ImagePickerAsset): FotoGaleria {
  const elegida: FotoElegida = { uri: asset.uri, mimeType: asset.mimeType, fileSize: asset.fileSize };
  return { clave: nuevaClave(), tipo: 'nueva', ...elegida };
}

// ---------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------

export default function GaleriaEditable({ fotos, onChange, error, deshabilitado = false }: Props) {
  const [aviso, setAviso] = useState<string | null>(null);
  const espacio = REGLAS.IMAGENES_MAX - fotos.length;

  async function agregar() {
    setAviso(null);
    const elegidas = await elegirFotos('Agregar fotografías', espacio);
    if (elegidas.length === 0) return;

    const validas = elegidas.filter((a) => !revisarFoto(a));
    const rechazada = elegidas.map(revisarFoto).find(Boolean);
    if (rechazada) setAviso(rechazada);
    if (validas.length > 0) onChange([...fotos, ...validas.map(aFotoNueva)]);
  }

  async function reemplazar(indice: number) {
    setAviso(null);
    const [elegida] = await elegirFotos('Reemplazar fotografía', 1);
    if (!elegida) return;
    const problema = revisarFoto(elegida);
    if (problema) {
      setAviso(problema);
      return;
    }
    onChange(fotos.map((f, i) => (i === indice ? aFotoNueva(elegida) : f)));
  }

  function eliminar(indice: number) {
    setAviso(null);
    if (fotos.length <= REGLAS.IMAGENES_MIN) {
      setAviso('La publicación debe tener al menos una fotografía. Usa "Reemplazar" para cambiarla.');
      return;
    }
    onChange(fotos.filter((_, i) => i !== indice));
  }

  function hacerPortada(indice: number) {
    setAviso(null);
    const copia = [...fotos];
    const [foto] = copia.splice(indice, 1);
    onChange([foto, ...copia]);
  }

  const mensaje = aviso ?? error;

  return (
    <View style={base.fieldSpacing}>
      <View style={estilos.encabezado}>
        <Text style={base.label}>FOTOGRAFÍAS</Text>
        <Text style={estilos.contador}>
          {fotos.length}/{REGLAS.IMAGENES_MAX}
        </Text>
      </View>

      <View style={estilos.rejilla}>
        {fotos.map((foto, i) => (
          <View key={foto.clave} style={estilos.celda}>
            <Image
              source={{ uri: foto.tipo === 'guardada' ? foto.url : foto.uri }}
              style={estilos.imagen}
              contentFit="cover"
              transition={150}
              accessibilityLabel={`Fotografía ${i + 1}`}
            />

            {i === 0 ? (
              <View style={[estilos.etiqueta, estilos.etiquetaPortada]}>
                <Text style={estilos.etiquetaTexto}>Portada</Text>
              </View>
            ) : null}
            {foto.tipo === 'nueva' ? (
              <View style={[estilos.etiqueta, estilos.etiquetaNueva]}>
                <Text style={estilos.etiquetaTexto}>Nueva</Text>
              </View>
            ) : null}

            <View style={estilos.acciones}>
              {i > 0 ? (
                <BotonIcono
                  icono="star-outline"
                  etiqueta={`Usar la fotografía ${i + 1} como portada`}
                  onPress={() => hacerPortada(i)}
                  deshabilitado={deshabilitado}
                />
              ) : null}
              <BotonIcono
                icono="swap-horizontal"
                etiqueta={`Reemplazar la fotografía ${i + 1}`}
                onPress={() => reemplazar(i)}
                deshabilitado={deshabilitado}
              />
              <BotonIcono
                icono="trash-outline"
                etiqueta={`Eliminar la fotografía ${i + 1}`}
                onPress={() => eliminar(i)}
                deshabilitado={deshabilitado}
                peligro
              />
            </View>
          </View>
        ))}

        {espacio > 0 ? (
          <TouchableOpacity
            style={[estilos.celda, estilos.agregar, mensaje ? estilos.agregarError : null]}
            onPress={agregar}
            disabled={deshabilitado}
            accessibilityRole="button"
            accessibilityLabel="Agregar fotografías">
            <Ionicons name="add" size={28} color={colors.primary} />
            <Text style={estilos.agregarTexto}>Agregar</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {mensaje ? (
        <Text style={base.errorText}>{mensaje}</Text>
      ) : (
        <Text style={estilos.ayuda}>
          La primera foto es la portada. Los cambios se aplican al guardar.
        </Text>
      )}
    </View>
  );
}

function BotonIcono({
  icono,
  etiqueta,
  onPress,
  deshabilitado,
  peligro = false,
}: {
  icono: keyof typeof Ionicons.glyphMap;
  etiqueta: string;
  onPress: () => void;
  deshabilitado: boolean;
  peligro?: boolean;
}) {
  return (
    <TouchableOpacity
      style={estilos.boton}
      onPress={onPress}
      disabled={deshabilitado}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}>
      <Ionicons name={icono} size={16} color={peligro ? colors.error : colors.title} />
    </TouchableOpacity>
  );
}

const estilos = StyleSheet.create({
  encabezado: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  contador: { fontSize: 12, fontWeight: '600', color: colors.text },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  celda: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  imagen: { width: '100%', height: '100%' },
  etiqueta: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  etiquetaPortada: { backgroundColor: colors.primary },
  etiquetaNueva: { backgroundColor: colors.success, left: undefined, right: 6 },
  etiquetaTexto: { fontSize: 10, fontWeight: '700', color: colors.white },
  acciones: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    gap: 6,
  },
  boton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  agregar: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  agregarError: { borderColor: colors.error },
  agregarTexto: { fontSize: 13, fontWeight: '700', color: colors.primary },
  ayuda: { fontSize: 12, color: colors.text, marginTop: 8 },
});