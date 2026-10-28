// scripts/limpiar.mjs — Borra archivos de la plantilla de Expo que el proyecto ya no usa
//
//   node scripts/limpiar.mjs          muestra qué se borraría (no borra nada)
//   node scripts/limpiar.mjs --si     los borra
//
// Se revisó que ningún archivo del proyecto los importa. Después de borrarlos
// corre `npm run typecheck` para confirmar.

import { existsSync, readdirSync, rmSync, rmdirSync } from 'node:fs';

const SIN_USO = [
  // Componentes y hooks de la plantilla (nadie los importa; la app usa src/components/auth/styles.ts)
  'src/components/themed-text.tsx',
  'src/components/themed-view.tsx',
  'src/hooks/use-theme.ts',
  'src/hooks/use-color-scheme.ts',
  'src/hooks/use-color-scheme.web.ts',
  // Ícono animado de Expo (solo se usaba en la pantalla de bienvenida de la plantilla)
  'src/components/animated-icon.module.css',
  'assets/images/logo-glow.png',
  // Fuentes CSS que solo usaba ThemedText
  'src/global.css',
];

const borrar = process.argv.includes('--si');
const encontrados = SIN_USO.filter((ruta) => existsSync(ruta));

if (encontrados.length === 0) {
  console.log('No hay nada que limpiar.');
  process.exit(0);
}

for (const ruta of encontrados) {
  if (borrar) rmSync(ruta);
  console.log(`${borrar ? 'Borrado ' : 'Se borraría'}  ${ruta}`);
}

// La carpeta src/hooks queda vacía
if (borrar && existsSync('src/hooks') && readdirSync('src/hooks').length === 0) {
  rmdirSync('src/hooks');
  console.log('Borrado   src/hooks/');
}

if (!borrar) console.log('\nPara borrarlos de verdad: node scripts/limpiar.mjs --si');