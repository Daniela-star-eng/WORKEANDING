// /api/publications — Publicaciones de productos y servicios (Sprint 4 · PB-04 / PB-05)
//
//   POST /api/publications   Crea una publicación (solo prestadores, requiere sesión)
//   GET  /api/publications   Lista publicaciones APROBADAS y DISPONIBLES (requiere sesión)
//                            ?categoria_id=1 &tipo=PRODUCTO|SERVICIO &limite=20 &pagina=1
//                            &mias=true (todas las del prestador, en cualquier estado)
//
// Documentación completa: GET /api/docs (Swagger UI) o docs/openapi.json

import { TIPOS_PUBLICACION, type TipoPublicacion } from '@/lib/publicaciones/tipos';
import { normalizarEntrada } from '@/lib/publicaciones/validadores';
import {
  autenticar,
  errorJson,
  json,
  leerJson,
  manejarErrorInterno,
} from '@/server/http';
import { crearPublicacion, listarPublicaciones, validarEnServidor } from '@/server/publicaciones';
import { clienteSupabase } from '@/server/supabase';

export async function POST(request: Request) {
  try {
    // 1. Sesión
    const auth = await autenticar(request);
    if ('respuesta' in auth) return auth.respuesta;

    // 2. Esquema del cuerpo
    const datos = normalizarEntrada(await leerJson(request));
    if (!datos) {
      return errorJson(400, 'VALIDACION', 'El cuerpo debe ser un objeto JSON.', {
        cuerpo: 'Envía los datos de la publicación en formato JSON.',
      });
    }

    // 3. Cadena de validaciones (Chain of Responsibility)
    const supabase = clienteSupabase(auth.token);
    const ctx = await validarEnServidor(supabase, auth.usuario.id, datos);
    if (ctx.fallo) return errorJson(ctx.fallo.estado, ctx.fallo.codigo, ctx.fallo.mensaje);
    if (Object.keys(ctx.errores).length > 0) {
      return errorJson(400, 'VALIDACION', 'Revisa los datos de la publicación.', ctx.errores);
    }

    // 4. Guardar (la base de datos valida otra vez y guarda todo en una transacción)
    const { publicacion, error } = await crearPublicacion(supabase, ctx.datos);
    if (error) {
      return errorJson(
        error.estado,
        error.codigo,
        error.mensaje,
        error.campo ? { [error.campo]: error.mensaje } : undefined
      );
    }

    const avisos =
      publicacion.estado_moderacion === 'PENDIENTE'
        ? ['Tu publicación quedó en revisión y será visible cuando un moderador la apruebe.']
        : [];

    return json({ data: publicacion, avisos }, 201, {
      Location: `/api/publications/${publicacion.id}`,
    });
  } catch (e) {
    return manejarErrorInterno(e);
  }
}

function enteroEnRango(valor: string | null, porDefecto: number, min: number, max: number) {
  if (valor == null || valor === '') return porDefecto;
  const n = Number(valor);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;

    const limite = enteroEnRango(params.get('limite'), 20, 1, 50);
    const pagina = enteroEnRango(params.get('pagina'), 1, 1, 10_000);
    const categoriaId = enteroEnRango(params.get('categoria_id'), 0, 1, Number.MAX_SAFE_INTEGER);
    const tipo = params.get('tipo')?.toUpperCase();
    const soloMias = params.get('mias') === 'true';

    if (limite == null) return errorJson(400, 'VALIDACION', 'limite debe ser un entero entre 1 y 50.');
    if (pagina == null) return errorJson(400, 'VALIDACION', 'pagina debe ser un entero mayor a 0.');
    if (categoriaId == null) return errorJson(400, 'VALIDACION', 'categoria_id debe ser un entero.');
    if (tipo && !TIPOS_PUBLICACION.includes(tipo as TipoPublicacion)) {
      return errorJson(400, 'VALIDACION', 'tipo debe ser PRODUCTO o SERVICIO.');
    }

    // Las publicaciones solo las ven usuarios con sesión (política "Publicaciones visibles")
    const auth = await autenticar(request);
    if ('respuesta' in auth) return auth.respuesta;

    const resultado = await listarPublicaciones(clienteSupabase(auth.token), {
      categoriaId: categoriaId || undefined,
      tipo: tipo as TipoPublicacion | undefined,
      usuarioId: auth.usuario.id,
      soloMias,
      limite,
      pagina,
    });
    if (resultado.error) {
      return errorJson(resultado.error.estado, resultado.error.codigo, resultado.error.mensaje);
    }

    return json({
      data: resultado.publicaciones,
      paginacion: {
        pagina,
        limite,
        total: resultado.total,
        paginas: Math.ceil(resultado.total / limite),
      },
    });
  } catch (e) {
    return manejarErrorInterno(e);
  }
}