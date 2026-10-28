// PUT /api/publications/:id/images — Actualizar la galería al editar (Sprint 5)
//
// Cuerpo: { "imagenes": ["<id usuario>/foto-1.jpg", "<id usuario>/nueva.jpg", ...] }
//   Lista FINAL de fotos en orden (la primera es la portada), de 1 a 8.
//   · Las que ya tenía y siguen en la lista se conservan.
//   · Las nuevas deben estar subidas antes al bucket "publicaciones" (carpeta del usuario).
//   · Las que ya no vienen se quitan de la publicación y se borran del bucket.
//
// Solo el autor de la publicación puede cambiar sus fotos.

import { autenticar, errorJson, json, leerJson, manejarErrorInterno } from '@/server/http';
import { actualizarGaleria, normalizarCambioGaleria, validarGaleria } from '@/server/galeria';
import { clienteSupabase } from '@/server/supabase';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PUT(request: Request, { id }: Record<string, string>) {
  try {
    if (!UUID.test(id)) return errorJson(400, 'VALIDACION', 'El id de la publicación no es válido.');

    // 1. Sesión
    const auth = await autenticar(request);
    if ('respuesta' in auth) return auth.respuesta;

    // 2. Esquema del cuerpo
    const imagenes = normalizarCambioGaleria(await leerJson(request));
    if (!imagenes) {
      return errorJson(400, 'VALIDACION', 'El cuerpo debe ser un objeto JSON con la lista "imagenes".', {
        cuerpo: 'Envía { "imagenes": [ ...rutas ] }.',
      });
    }

    // 3. Cadena de validaciones
    const ctx = await validarGaleria(imagenes);
    if (ctx.errores.imagenes) {
      return errorJson(400, 'VALIDACION', 'Revisa las fotografías.', { imagenes: ctx.errores.imagenes });
    }

    // 4. Sincronizar BD (transacción) y Storage
    const resultado = await actualizarGaleria(clienteSupabase(auth.token), id, imagenes);
    if (resultado.error) {
      const { estado, codigo, mensaje, campo } = resultado.error;
      return errorJson(estado, codigo, mensaje, campo ? { [campo]: mensaje } : undefined);
    }

    return json({ data: resultado.publicacion, eliminadas: resultado.eliminadas });
  } catch (e) {
    return manejarErrorInterno(e);
  }
}