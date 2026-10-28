# Workeando · Multimedia adaptada a la base existente

Esta versión reemplaza la primera entrega. Usa la estructura compartida por el equipo:
- Tabla `publicaciones` (categoría obligatoria, propietario, título y moderación).
- Tabla `imagenes_publicacion` (id, publicacion_id, url, orden, ruta).
- Bucket público `publicaciones`, con límite existente de 5 MiB.

**No ejecutes el SQL de la entrega anterior. Esta integración no requiere crear tablas,
buckets ni sustituir políticas.** El archivo `supabase/03_multimedia_publicaciones.sql`
ahora contiene únicamente una consulta SELECT opcional. Si ya ejecutaste una copia antigua,
esta entrega no borra lo que aquella creó; hay que revisar por separado esos objetos.

## Instalación

1. Descomprime esta nueva versión en otra carpeta para no mezclar archivos antiguos.
2. Copia tu `.env` del proyecto que ya funciona a la raíz de Workeando. No está incluido.
   Utiliza EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_KEY (clave publicable/anon).
   Nunca pongas service_role en la aplicación.
3. Ejecuta `npm install` y después `npx expo start -c`.
4. Usa un dispositivo/entorno compatible con Expo SDK 57; recompila el development build
   si todavía no incluye los módulos nativos nuevos.
5. Inicia sesión, abre Publicar, elige una categoría activa, escribe título y descripción.
6. Selecciona las fotos, cambia el orden con las flechas, quita las que no necesites y envía.
7. Revisa Mis publicaciones recientes y los registros en Supabase.

Si no aparecen categorías, consulta al responsable de ese catálogo. El módulo no inventa
categorías ni modifica su activación. Para publicar no es obligatorio proporcionar precio,
ubicación o unidad de precio según la estructura compartida. Se envía el tipo de la categoría;
moderación, disponibilidad y fechas conservan los valores predeterminados de la BD.
El formulario permite guardar también cuando el tipo de la categoría es nulo.

## Entregables y funciones para explicar

| Archivo | Funciones y responsabilidad |
|---|---|
| src/components/multimedia/CargaImagenes.tsx | seleccionar(): selector múltiple; Image: miniaturas; moverImagen(): flechas; filter(): quitar antes de subir |
| src/services/imagenes.ts | leerImagen(): ArrayBuffer móvil/web; optimizarImagen(): validación y reducción de dimensiones/calidad |
| src/utils/validarImagenes.ts | validarTamano(), detectarFormato(), validarCantidad(), moverImagen() |
| src/services/publicaciones.ts | listarCategorias(), listarPublicaciones(), publicarConFotos(), descartarIntento() |
| src/app/(tabs)/publicar.tsx | Formulario de categoría/título/descripcion/fotos; enviar(); progreso; recuperación del intento con AsyncStorage |
| tests/imagenes.test.mjs | 7 pruebas de formatos, tamaño, cantidad y orden |
| tests/publicaciones.test.cjs | 6 pruebas del servicio con Supabase simulado, incluyendo fallos y reintentos |

Se modificaron navegación móvil/web, Inicio, mensaje del permiso en app.json y dependencias
package.json/package-lock.json. Se conservó la lógica de registro, login y perfil.
Dependencias añadidas: expo-image-manipulator, expo-file-system y expo-crypto para SDK 57.

## Flujo real de subida

1. El selector recibe de 1 a 6 fotos JPG/PNG. Se validan tamaño y firma binaria.
2. Cada imagen se optimiza a JPEG, calidad 0.8, lado mayor de hasta 1600 píxeles.
3. El componente muestra la selección local; la primera imagen será la portada.
4. Al enviar se guarda localmente un ID de intento, IDs de fotos y datos del formulario.
5. Se consulta si ese intento ya existe. Si sus imágenes ya están registradas, se recupera
   la confirmación sin duplicar filas.
6. Se suben imágenes faltantes al bucket `publicaciones`, en rutas:
   `usuario_id/publicacion_id/imagen_id.jpg`.
7. Se inserta la publicación con `categoria_id`, usuario, título, descripción y tipo.
8. Se insertan las imágenes EN LOTE en `imagenes_publicacion`. Cada fila contiene su ID,
   publicacion_id, URL pública, ruta y orden desde 1. No se usa UPDATE de imágenes porque
   tus políticas solo incluyen SELECT, INSERT y DELETE para esa tabla.
9. Se limpia el intento local y se consulta la galería desde PostgreSQL.

El estado de moderación queda PENDIENTE por defecto. La app no aprueba publicaciones.
La lista filtra explícitamente por el usuario actual: las RLS también permiten leer publicaciones
aprobadas de otros usuarios, pero no se muestran en Mis publicaciones.

## Validaciones y alcance

- Entre 1 y 6 fotografías por envío; originales y procesadas con máximo 5 MiB cada una.
- Solo JPG/JPEG y PNG recibidos por el selector. Se revisa MIME cuando está disponible y
  firma binaria. No basta renombrar un GIF a JPG. Expo debe poder decodificar la imagen.
- Hasta 40 megapíxeles de entrada. Se procesa secuencialmente para limitar uso de memoria.
- Las fotos PNG se convierten a JPEG y pierden transparencia; se informa en pantalla.
- Título de 3 a 100 caracteres, descripción de hasta 2000 y categoría activa requerida.
- Esta entrega cubre fotografías, no video/audio.
- Los límites de cantidad y JPG/PNG se aplican en este módulo. El bucket existente también
  admite WEBP; no cambiamos esa configuración para no afectar otros componentes.
- La estructura que enviaste no incluye una restricción de seis fotos en PostgreSQL.
  Un cliente que omita estas validaciones podría insertar más. Si el equipo necesita ese
  límite global, debe acordarse una validación backend adicional; no se añadió silenciosamente.
- Las fotos tienen URL pública, incluso antes de asociarlas a la publicación. La moderación
  limita visibilidad de filas, no el acceso directo a la URL. No subir documentos privados.

## Fallos y recuperación sin alterar permisos

Storage y las dos tablas no comparten una única transacción. Si falla la subida, no se crea
la publicación. Si falla el registro de URLs después de crearla, la publicación puede quedar
PENDIENTE sin imágenes temporalmente. El mismo intento se conserva y Reintentar lo completa.
El INSERT de imágenes en lote es atómico dentro de PostgreSQL.

Si se pierde la respuesta del servidor, los IDs estables permiten comprobar el resultado sin
repetir registros. Antes de volver a leer un archivo local se comprueba si ya está en Storage;
así se recuperan intentos incluso si se ha eliminado la caché de una imagen ya subida.

Descartar elimina únicamente archivos del intento cuando todavía no existe la publicación.
Si la publicación ya existe, se solicita Reintentar: no se agrega una política DELETE ni se
eliminan publicaciones. El formulario queda bloqueado durante un intento pendiente para
mantener sus fotos y datos estables. No ejecutes el mismo intento desde dos dispositivos.

El intento local se guarda por cuenta con clave versión v2. Los intentos de la primera entrega
usaban otra tabla y no se migran automáticamente. No borres registros remotos sin revisarlos.
Desinstalar la app pierde los datos locales: podría requerirse limpieza administrativa de fotos
huérfanas. No se implementó edición de publicaciones confirmadas ni catálogo público.

## Pruebas y evidencia

Se verificaron TypeScript, la compilación web de Expo con variables ficticias y 13 pruebas automatizadas: siete de imágenes y seis de servicio.
Las pruebas del servicio usan Supabase simulado, no una conexión real. No se ejecutó ningún
SQL ni se subieron fotos a tu cuenta. Las políticas/columnas se contrastaron con el archivo
que proporcionaste; permisos GRANT, triggers y datos reales del catálogo requieren prueba real.

```sh
npm run typecheck
node --experimental-strip-types --test tests/imagenes.test.mjs
node --test tests/publicaciones.test.cjs
```

Prueba manual en tu teléfono:
1. Seleccionar categoría y tres fotos: captura del formulario y miniaturas.
2. Mover la tercera al inicio y quitar una: captura del nuevo orden.
3. Probar una imagen de más de 5 MiB, un formato no permitido y el límite de seis.
4. Publicar: captura de confirmación y de Mis publicaciones con estado PENDIENTE.
5. Storage > publicaciones: capturar las rutas del usuario y publicación.
6. Table Editor > publicaciones: comprobar categoría, propietario y título.
7. Table Editor > imagenes_publicacion: comprobar dos filas con URL, ruta y orden 1 y 2.
8. Reabrir app y verificar que se consulten las fotos guardadas.
9. Cortar internet y reintentar: verificar que no aumente el número de publicaciones/filas.
10. Comprobar acceso con otra cuenta conforme a las políticas actuales.

Si aparece un error, copia el mensaje completo: el servicio ahora conserva el código y mensaje
de Supabase para identificar si falta un permiso, una categoría o una condición de un trigger.
No muestres .env ni tokens en las evidencias.

## Referencias
- https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/
- https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/
- https://supabase.com/docs/guides/storage/security/access-control
