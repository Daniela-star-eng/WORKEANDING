export const MAX_FOTOS = 6;
export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_LADO = 1600;

export function validarTamano(bytes: number): void {
  if (!Number.isFinite(bytes) || bytes <= 0) throw new Error('El archivo está vacío o no se pudo leer.');
  if (bytes > MAX_BYTES) throw new Error('Cada fotografía debe pesar como máximo 5 MB.');
}

/** Verifica la firma binaria, no solamente la extensión del archivo. */
export function detectarFormato(bytes: Uint8Array): 'image/jpeg' | 'image/png' {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)) return 'image/png';
  throw new Error('Solo se admiten imágenes JPG o PNG.');
}

export function validarCantidad(cantidad: number): void {
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_FOTOS) {
    throw new Error(`Selecciona entre 1 y ${MAX_FOTOS} fotografías.`);
  }
}

export function moverImagen<T>(lista: T[], desde: number, hacia: number): T[] {
  if (desde < 0 || desde >= lista.length || hacia < 0 || hacia >= lista.length) return lista;
  const copia = [...lista];
  const [elemento] = copia.splice(desde, 1);
  copia.splice(hacia, 0, elemento);
  return copia;
}
