import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';
import { randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';
import { detectarFormato, MAX_BYTES, MAX_LADO, validarTamano } from '@/utils/validarImagenes';

export type FotoLocal = { id: string; uri: string; nombre: string; bytes: number; originalBytes: number };

export async function leerImagen(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS !== 'web') {
    const archivo = new File(uri);
    validarTamano(archivo.size);
    return archivo.arrayBuffer();
  }
  const respuesta = await fetch(uri);
  if (!respuesta.ok) throw new Error('No se pudo leer la imagen.');
  const blob = await respuesta.blob();
  validarTamano(blob.size);
  return blob.arrayBuffer();
}

export async function optimizarImagen(asset: ImagePickerAsset): Promise<FotoLocal> {
  if (asset.fileSize != null) validarTamano(asset.fileSize);
  // Rechazar formatos originales no admitidos aunque el selector los convierta.
  if (asset.mimeType && !['image/jpeg', 'image/png'].includes(asset.mimeType.toLowerCase())) {
    throw new Error('Solo se admiten JPG y PNG; convierte HEIC, WEBP o GIF antes de seleccionarlos.');
  }
  const original = await leerImagen(asset.uri);
  detectarFormato(new Uint8Array(original));
  if (asset.width <= 0 || asset.height <= 0 || asset.width * asset.height > 40_000_000) {
    throw new Error('La imagen debe tener dimensiones válidas y no superar 40 megapíxeles.');
  }
  const contexto = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_LADO) {
    contexto.resize(asset.width >= asset.height ? { width: MAX_LADO } : { height: MAX_LADO });
  }
  const imagen = await contexto.renderAsync();
  try {
    // Las fotos se normalizan a JPEG. Los PNG transparentes pierden transparencia.
    const resultado = await imagen.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
    const optimizada = await leerImagen(resultado.uri);
    if (optimizada.byteLength > MAX_BYTES) throw new Error('La imagen optimizada supera 5 MB.');
    detectarFormato(new Uint8Array(optimizada));
    return { id: randomUUID(), uri: resultado.uri, nombre: asset.fileName ?? 'Fotografía',
      bytes: optimizada.byteLength, originalBytes: original.byteLength };
  } finally {
    imagen.release();
    contexto.release();
  }
}
