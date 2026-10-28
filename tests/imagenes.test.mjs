import assert from 'node:assert/strict';
import test from 'node:test';
import { detectarFormato, MAX_BYTES, moverImagen, validarCantidad, validarTamano } from '../src/utils/validarImagenes.ts';
test('Acepta firmas JPG y PNG', () => {
  assert.equal(detectarFormato(new Uint8Array([255,216,255,224])), 'image/jpeg');
  assert.equal(detectarFormato(new Uint8Array([137,80,78,71,13,10,26,10])), 'image/png');
});
test('Rechaza GIF, WEBP y contenido vacío aunque se renombre a JPG', () => {
  for (const b of [[], [71,73,70,56], [82,73,70,70]]) assert.throws(() => detectarFormato(new Uint8Array(b)));
});
test('Acepta exactamente 5 MB y rechaza un byte adicional', () => {
  assert.doesNotThrow(() => validarTamano(MAX_BYTES));
  assert.throws(() => validarTamano(MAX_BYTES + 1));
});
test('Rechaza tamaño cero, negativo y no finito', () => {
  for (const n of [0,-1,NaN,Infinity]) assert.throws(() => validarTamano(n));
});
test('Exige entre una y seis fotografías', () => {
  for (const n of [1,6]) assert.doesNotThrow(() => validarCantidad(n));
  for (const n of [0,7,-1,1.5]) assert.throws(() => validarCantidad(n));
});
test('Reordenar cambia la portada sin mutar el original', () => {
  const original=['A','B','C'];
  assert.deepEqual(moverImagen(original,2,0),['C','A','B']);
  assert.deepEqual(original,['A','B','C']);
});
test('Mover fuera de límites no pierde imágenes', () => {
  assert.deepEqual(moverImagen(['A','B'],0,-1),['A','B']);
  assert.deepEqual(moverImagen(['A','B'],1,2),['A','B']);
});
