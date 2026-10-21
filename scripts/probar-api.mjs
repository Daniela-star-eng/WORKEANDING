// scripts/probar-api.mjs — Corre la colección de Postman del Sprint 4 sin abrir Postman
//
//   npm run test:api
//
// 1. Revisa que todo esté listo (variables, foto de prueba, app corriendo).
// 2. Corre la colección con newman (Postman en línea de comandos).
// 3. Genera postman/reporte-sprint4.html con el resultado de cada petición.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'postman';
const COLECCION = join(DIR, 'Workeando_Sprint4_Publicaciones.postman_collection.json');
const ENTORNO = join(DIR, 'Workeando_local.postman_environment.json');
const FOTO = join(DIR, 'foto_prueba.jpg');
const RESULTADO = join(DIR, '.resultado-newman.json');
const REPORTE = join(DIR, 'reporte-sprint4.html');

const rojo = (t) => `\x1b[31m${t}\x1b[0m`;
const verde = (t) => `\x1b[32m${t}\x1b[0m`;

function detener(mensaje) {
  console.error(rojo(`\n✘ ${mensaje}\n`));
  process.exit(1);
}

// ---------- 1. Revisiones previas ----------
const variables = Object.fromEntries(
  JSON.parse(readFileSync(ENTORNO, 'utf8')).values.map((v) => [v.key, v.value])
);

const faltan = ['supabase_url', 'anon_key', 'email', 'password', 'email_cliente', 'password_cliente'].filter(
  (k) => !variables[k] || /TU-PROYECTO|PEGA_AQUI|^(prestador|cliente)@workeando\.com$/.test(variables[k])
);
if (faltan.length) {
  detener(
    `Llena estas variables en ${ENTORNO}: ${faltan.join(', ')}\n` +
      '  · supabase_url y anon_key: Supabase > Project Settings > API\n' +
      '  · email/password: un usuario PRESTADOR con foto de perfil\n' +
      '  · email_cliente/password_cliente: un usuario CLIENTE'
  );
}
if (!existsSync(FOTO)) {
  detener(`Falta ${FOTO}: copia ahí cualquier foto JPG de menos de 5 MB con ese nombre.`);
}
try {
  const r = await fetch(`${variables.base_url}/api/categories`);
  if (!r.ok) throw new Error(`respondió ${r.status}`);
} catch (e) {
  detener(
    `No responde ${variables.base_url}/api/categories (${e.message}).\n` +
      '  Abre otra terminal y corre: npx expo start'
  );
}

// ---------- 2. Correr la colección ----------
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
spawnSync(
  npx,
  ['-y', 'newman@6', 'run', COLECCION, '-e', ENTORNO, '--working-dir', DIR,
   '-r', 'cli,json', '--reporter-json-export', RESULTADO],
  { stdio: 'inherit', shell: process.platform === 'win32' }
);
if (!existsSync(RESULTADO)) detener('newman no generó resultados (revisa el error de arriba).');

// ---------- 3. Reporte HTML ----------
const { run } = JSON.parse(readFileSync(RESULTADO, 'utf8'));
unlinkSync(RESULTADO);

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const filas = run.executions.map((ex) => {
  const pruebas = ex.assertions ?? [];
  const fallidas = pruebas.filter((a) => a.error);
  const ok = !ex.requestError && fallidas.length === 0;
  const url = ex.request?.url;
  const ruta = url ? '/' + (url.path ?? []).join('/') + (url.query?.length ? '?' + url.query.map((q) => `${q.key}=${q.value}`).join('&') : '') : '';
  return `<tr class="${ok ? 'ok' : 'mal'}">
    <td>${ok ? '✔' : '✘'}</td>
    <td>${esc(ex.item.name)}</td>
    <td><code>${esc(ex.request?.method)} ${esc(ruta)}</code></td>
    <td>${esc(ex.response?.code ?? 'sin respuesta')}</td>
    <td>${esc(ex.response?.responseTime ?? '')} ms</td>
    <td>${pruebas.map((a) => `<div class="${a.error ? 'mal' : 'ok'}">${a.error ? '✘' : '✔'} ${esc(a.assertion)}${a.error ? ` — <em>${esc(a.error.message)}</em>` : ''}</div>`).join('')}
        ${ex.requestError ? `<div class="mal">✘ ${esc(ex.requestError.message)}</div>` : ''}</td>
  </tr>`;
});

const st = run.stats;
const total = st.assertions.total;
const fallas = st.assertions.failed;
const fecha = new Date().toLocaleString('es-MX');

writeFileSync(
  REPORTE,
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Workeando · Pruebas API Sprint 4</title>
<style>
  body{font-family:system-ui,sans-serif;margin:24px;color:#1B1642;background:#F9F8F4}
  h1{margin:0 0 4px}.sub{color:#6B6B7B;margin:0 0 20px}
  .tarjetas{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}
  .t{background:#fff;border:1px solid #E7E5EE;border-radius:12px;padding:12px 18px}
  .t b{display:block;font-size:26px}
  table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #E7E5EE}
  th,td{padding:8px 10px;border-bottom:1px solid #E7E5EE;text-align:left;vertical-align:top;font-size:14px}
  th{background:#EEF0FF}tr.mal{background:#fff1f1}.ok{color:#1F9D55}.mal{color:#C62828}
  td div{color:inherit}td div.ok{color:#1F9D55}td div.mal{color:#C62828}code{font-size:12px}
</style></head><body>
<h1>Workeando · Pruebas de la API de publicaciones (Sprint 4)</h1>
<p class="sub">Generado el ${esc(fecha)} contra ${esc(variables.base_url)}</p>
<div class="tarjetas">
  <div class="t"><b>${st.requests.total}</b>peticiones</div>
  <div class="t"><b>${total - fallas}/${total}</b>verificaciones correctas</div>
  <div class="t"><b class="${fallas ? 'mal' : 'ok'}">${fallas ? fallas + ' fallas' : 'Sin fallas'}</b>resultado</div>
  <div class="t"><b>${Math.round(run.timings.completed - run.timings.started)} ms</b>duración</div>
</div>
<table><thead><tr><th></th><th>Prueba</th><th>Petición</th><th>Código</th><th>Tiempo</th><th>Verificaciones</th></tr></thead>
<tbody>${filas.join('')}</tbody></table></body></html>`
);

console.log(
  (fallas ? rojo(`\n${fallas} verificaciones fallaron`) : verde('\nTodas las verificaciones pasaron')) +
    `\nReporte: ${REPORTE}\n`
);
process.exit(fallas ? 1 : 0);