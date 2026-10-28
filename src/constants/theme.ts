/**
 * Medidas generales de la app.
 * La paleta de marca de Workeando (colores, botones, campos) vive en
 * `src/components/auth/styles.ts`.
 */

import { Platform } from 'react-native';

/** Espaciados (los usa la barra de pestañas web) */
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Espacio que ocupa la barra de pestañas nativa */
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;