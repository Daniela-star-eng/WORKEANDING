import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { optimizarImagen, type FotoLocal } from '@/services/imagenes';
import { MAX_FOTOS, moverImagen } from '@/utils/validarImagenes';

type Props = { value: FotoLocal[]; onChange: (fotos: FotoLocal[]) => void;
  disabled?: boolean; onBusyChange?: (busy: boolean) => void };

export default function CargaImagenes({ value, onChange, disabled, onBusyChange }: Props) {
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const bloqueo = useRef(false);
  const ocupado = disabled || procesando;
  async function seleccionar() {
    if (ocupado || bloqueo.current || value.length >= MAX_FOTOS) return;
    bloqueo.current = true;
    setProcesando(true); onBusyChange?.(true); setMensaje('');
    try {
      // El selector del sistema permite acceso únicamente a los elementos elegidos.
      // No se solicita acceso completo a la galería ni permisos de cámara/audio.
      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsMultipleSelection: true, allowsEditing: false,
        selectionLimit: MAX_FOTOS - value.length, orderedSelection: true, quality: 1,
      });
      if (resultado.canceled) return;
      const disponibles = MAX_FOTOS - value.length;
      const errores: string[] = [];
      if (resultado.assets.length > disponibles) errores.push(`Solo se tomarán las primeras ${disponibles} fotos.`);
      const nuevas: FotoLocal[] = [];
      for (const asset of resultado.assets.slice(0, disponibles)) {
        try { nuevas.push(await optimizarImagen(asset)); }
        catch (e) { errores.push(`${asset.fileName ?? 'Imagen'}: ${e instanceof Error ? e.message : 'No se pudo procesar.'}`); }
      }
      onChange([...value, ...nuevas]);
      setMensaje(errores.join('\n'));
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : 'No se pudo abrir la galería. Revisa los permisos en Ajustes.');
    } finally { bloqueo.current = false; setProcesando(false); onBusyChange?.(false); }
  }
  return <View style={s.section}>
    <Text style={s.heading}>Fotografías · {value.length}/{MAX_FOTOS}</Text>
    <Text style={s.help}>JPG o PNG · máximo 5 MB cada una. La primera foto será la portada.</Text>
    <Text style={s.help}>Se optimizan a JPEG, hasta 1600 px. Los PNG pierden transparencia.</Text>
    <Pressable accessibilityRole="button" disabled={ocupado || value.length >= MAX_FOTOS}
      onPress={seleccionar} style={[s.add, (ocupado || value.length >= MAX_FOTOS) && s.disabled]}>
      <Text style={s.addText}>+ Seleccionar fotografías</Text>
    </Pressable>
    {procesando && <View><ActivityIndicator color="#4169E1" /><Text>Optimizando fotografías…</Text></View>}
    {!!mensaje && <Text accessibilityRole="alert" style={s.error}>{mensaje}</Text>}
    <View style={s.grid}>{value.map((foto, i) => <View key={foto.id} style={s.card}>
      <Image source={{ uri: foto.uri }} accessibilityLabel={`Vista previa de fotografía ${i + 1}`} style={s.image} />
      <Text style={s.label}>{i === 0 ? '1 · Portada' : `${i + 1} · Fotografía`}</Text>
      <Text style={s.help}>{Math.round(foto.bytes / 1024)} KB</Text>
      <View style={s.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Mover foto ${i + 1} antes`}
          disabled={ocupado || i === 0} onPress={() => onChange(moverImagen(value, i, i - 1))}
          style={[s.control, (ocupado || i === 0) && s.disabled]}><Text>←</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Mover foto ${i + 1} después`}
          disabled={ocupado || i === value.length - 1} onPress={() => onChange(moverImagen(value, i, i + 1))}
          style={[s.control, (ocupado || i === value.length - 1) && s.disabled]}><Text>→</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Eliminar foto ${i + 1}`}
          disabled={ocupado} onPress={() => onChange(value.filter((f) => f.id !== foto.id))}
          style={[s.control, ocupado && s.disabled]}><Text style={s.error}>Quitar</Text></Pressable>
      </View>
    </View>)}</View>
  </View>;
}
const s = StyleSheet.create({
  section: { gap: 10 }, heading: { fontSize: 18, fontWeight: '700', color: '#172442' },
  help: { fontSize: 12, color: '#596780' }, add: { padding: 15, borderRadius: 12, backgroundColor: '#E9EEFF' },
  addText: { color: '#334FC4', fontWeight: '700', textAlign: 'center' }, disabled: { opacity: 0.35 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, card: { width: 190, padding: 8, gap: 6, backgroundColor: '#F3F5FA', borderRadius: 12 },
  image: { width: '100%', height: 130, borderRadius: 8 }, label: { fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 4 }, control: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center', padding: 4, backgroundColor: '#E1E6F0', borderRadius: 7 },
  error: { color: '#B42318', fontSize: 12 },
});
