// src/components/auth/FormComponents.tsx — Piezas extra para los formularios
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';

import { Field } from './AuthComponents';
import { formStyles as fs } from './formStyles';
import { colors, styles } from './styles';

/* ---------- Encabezado con flecha atrás (y logo opcional) ---------- */
export const FormHeader = ({
  onBack,
  showLogo = false,
}: {
  onBack: () => void;
  showLogo?: boolean;
}) => (
  <View style={fs.headerRow}>
    <TouchableOpacity style={fs.backButton} onPress={onBack} accessibilityLabel="Regresar">
      <Ionicons name="arrow-back" size={18} color={colors.title} />
    </TouchableOpacity>
    {showLogo ? <Text style={fs.logo}>W</Text> : null}
  </View>
);

/* ---------- Área de texto ---------- */
export const TextAreaField = ({
  label,
  error,
  ...inputProps
}: { label: string; error?: string } & TextInputProps) => (
  <View style={styles.fieldSpacing}>
    <Text style={styles.label}>{label}</Text>
    <View style={[fs.textAreaWrapper, error ? styles.inputWrapperError : null]}>
      <TextInput
        style={fs.textArea}
        multiline
        placeholderTextColor={colors.placeholder}
        {...inputProps}
      />
    </View>
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
  </View>
);

/* ---------- Selector (lista desplegable) ---------- */
export const SelectField = ({
  label,
  error,
  value,
  placeholder = 'Selecciona una opción',
  options,
  onChange,
}: {
  label: string;
  error?: string;
  value: string;
  placeholder?: string;
  options: string[];
  onChange: (value: string) => void;
}) => {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <Field label={label} error={error}>
        <TouchableOpacity style={fs.selectTouch} onPress={() => setAbierto(true)}>
          <Text style={value ? fs.selectValue : fs.selectPlaceholder}>
            {value || placeholder}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.icon} />
        </TouchableOpacity>
      </Field>

      <Modal
        visible={abierto}
        transparent
        animationType="fade"
        onRequestClose={() => setAbierto(false)}>
        <Pressable style={fs.modalOverlay} onPress={() => setAbierto(false)}>
          <Pressable style={fs.modalSheet}>
            <Text style={fs.modalTitle}>{label}</Text>
            <ScrollView>
              {options.map((op) => {
                const activo = op === value;
                return (
                  <TouchableOpacity
                    key={op}
                    style={fs.modalItem}
                    onPress={() => {
                      onChange(op);
                      setAbierto(false);
                    }}>
                    <Text style={[fs.modalItemText, activo && fs.modalItemTextActive]}>{op}</Text>
                    {activo ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

/* ---------- Interruptor con título y descripción ---------- */
export const ToggleRow = ({
  title,
  hint,
  value,
  onValueChange,
}: {
  title: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) => (
  <View style={fs.toggleRow}>
    <View style={fs.toggleTexts}>
      <Text style={fs.toggleTitle}>{title}</Text>
      {hint ? <Text style={fs.toggleHint}>{hint}</Text> : null}
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: colors.border, true: colors.primary }}
      thumbColor={colors.white}
    />
  </View>
);

/* ---------- Casilla de aceptación ---------- */
export const CheckboxRow = ({
  checked,
  onToggle,
  text,
  error,
}: {
  checked: boolean;
  onToggle: () => void;
  text: string;
  error?: string;
}) => (
  <View>
    <TouchableOpacity
      style={fs.checkboxRow}
      onPress={onToggle}
      activeOpacity={0.8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}>
      <View style={[fs.checkbox, checked && fs.checkboxChecked]}>
        {checked ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
      </View>
      <Text style={fs.checkboxText}>{text}</Text>
    </TouchableOpacity>
    {error ? (
      <Text style={[styles.errorText, { marginTop: -8, marginBottom: 12 }]}>{error}</Text>
    ) : null}
  </View>
);

/* ---------- Elegir imagen (cámara o galería) ---------- */
export type ImagenElegida = { uri: string; mimeType?: string };

/**
 * Pregunta si se usa la cámara o la galería y regresa la imagen elegida (o null).
 * En web solo existe la galería (los Alert con botones no funcionan en web).
 */
export function elegirImagen(
  titulo: string,
  opciones: ImagePicker.ImagePickerOptions = {}
): Promise<ImagenElegida | null> {
  const config: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, ...opciones };

  async function abrir(origen: 'camara' | 'galeria'): Promise<ImagenElegida | null> {
    if (origen === 'camara') {
      const permiso = await ImagePicker.requestCameraPermissionsAsync();
      if (!permiso.granted) {
        Alert.alert('Permiso necesario', 'Activa el acceso a la cámara para tomar la foto.');
        return null;
      }
    }
    const r =
      origen === 'camara'
        ? await ImagePicker.launchCameraAsync(config)
        : await ImagePicker.launchImageLibraryAsync(config);
    if (r.canceled) return null;
    const asset = r.assets[0];
    return { uri: asset.uri, mimeType: asset.mimeType ?? undefined };
  }

  if (Platform.OS === 'web') return abrir('galeria');

  return new Promise((resolve) => {
    Alert.alert(titulo, '¿Cómo quieres subir tu foto?', [
      { text: 'Tomar foto', onPress: () => abrir('camara').then(resolve) },
      { text: 'Elegir de galería', onPress: () => abrir('galeria').then(resolve) },
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}

/* ---------- Foto de perfil redonda (registro del prestador) ---------- */
export const AvatarField = ({
  label,
  imagen,
  error,
  onChange,
}: {
  label: string;
  imagen: ImagenElegida | null;
  error?: string;
  onChange: (imagen: ImagenElegida) => void;
}) => {
  async function abrirOpciones() {
    const elegida = await elegirImagen('Foto de perfil', { allowsEditing: true, aspect: [1, 1] });
    if (elegida) onChange(elegida);
  }

  return (
    <View style={[styles.fieldSpacing, { alignItems: 'center' }]}>
      <Text style={[styles.label, { alignSelf: 'flex-start' }]}>{label}</Text>
      <TouchableOpacity
        onPress={abrirOpciones}
        activeOpacity={0.85}
        accessibilityLabel={imagen ? 'Cambiar foto de perfil' : 'Agregar foto de perfil'}>
        <View
          style={[
            fs.avatar,
            { borderWidth: 2, borderColor: error ? colors.error : colors.primarySoft },
          ]}>
          {imagen ? (
            <Image source={{ uri: imagen.uri }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Ionicons name="person-outline" size={40} color={colors.primary} />
          )}
        </View>
        <View style={fs.avatarBadge}>
          <Ionicons name={imagen ? 'camera' : 'add'} size={16} color={colors.white} />
        </View>
      </TouchableOpacity>
      <Text style={[fs.toggleHint, { marginTop: 8, textAlign: 'center' }]}>
        Los clientes confían más en prestadores con foto.
      </Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

/* ---------- Campo para subir foto con vista previa ---------- */
export const ImageUploadField = ({
  label,
  text,
  uri,
  error,
  onChange,
}: {
  label: string;
  text: string;
  uri: string | null;
  error?: string;
  onChange: (uri: string) => void;
}) => {
  async function abrirOpciones() {
    const imagen = await elegirImagen('Identificación oficial');
    if (imagen) onChange(imagen.uri);
  }

  return (
    <View style={styles.fieldSpacing}>
      <Text style={styles.label}>{label}</Text>

      {uri ? (
        <TouchableOpacity style={fs.previewWrap} onPress={abrirOpciones} activeOpacity={0.9}>
          <Image source={{ uri }} style={fs.preview} resizeMode="cover" />
          <View style={fs.previewBadge}>
            <Ionicons name="camera-outline" size={14} color={colors.white} />
            <Text style={fs.previewBadgeText}>Cambiar foto</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[fs.uploadBox, error ? fs.uploadBoxError : null]}
          onPress={abrirOpciones}
          activeOpacity={0.8}>
          <Ionicons name="camera-outline" size={22} color={colors.primary} />
          <Text style={fs.uploadText}>{text}</Text>
        </TouchableOpacity>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};