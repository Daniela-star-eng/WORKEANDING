# Workeando

App móvil (Expo + Supabase) donde los usuarios pueden **poner en renta sus servicios** (prestadores) y otros usuarios pueden **rentarlos** (clientes).

Este proyecto une las dos versiones que existían:

| Venía de | Qué aporta |
|---|---|
| `MiApp` (backend) | Sesión con `AuthProvider` y rutas protegidas, servicio de perfil del Sprint 3, SQL y colección de Postman |
| `MiApp front` | Diseño de las pantallas: login, elección de tipo de cuenta, registro de cliente y de prestador (con foto de identificación) |

## Cómo arrancar

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Copia `.env.example` como `.env` y pon la URL y la *anon key* de tu proyecto de Supabase.

3. En Supabase > SQL Editor ejecuta, en este orden:
   1. `supabase/01_auth_usuarios.sql`
   2. `supabase/02_sprint3_perfil.sql`

4. Inicia la app:

   ```bash
   npx expo start
   ```

Para revisar tipos: `npm run typecheck`.

## Estructura

```
src/
  app/
    _layout.tsx               Raíz: AuthProvider + rutas protegidas (con / sin sesión)
    (auth)/                   Solo sin sesión
      login.tsx               /login
      registro.tsx            /registro            ¿Busco u ofrezco servicios?
      registro-cliente.tsx    /registro-cliente
      registro-prestador.tsx  /registro-prestador
    (tabs)/                   Solo con sesión
      index.tsx               /        Inicio
      perfil.tsx              /perfil  Editar perfil (Sprint 3)
  components/
    auth/                     Diseño de marca (campos, botones, estilos, formularios)
    app-tabs(.web).tsx        Barra de pestañas nativa / web
  lib/supabase.ts             Cliente de Supabase
  providers/auth-provider.tsx Sesión y perfil del usuario (useAuth)
  services/
    auth.ts                   Login, logout, obtenerPerfil, mensajes de error
    registro.ts               Registro de cliente y prestador, foto de identificación
    perfil.ts                 Editar perfil y subir foto (Sprint 3)
supabase/                     Scripts SQL
postman/                      Pruebas de la API de perfil
```

## Cómo funciona la sesión

`src/app/_layout.tsx` usa `Stack.Protected`: si hay sesión se muestran las pestañas, si no, las pantallas de `(auth)`. Por eso las pantallas **no navegan** después de iniciar sesión, registrarse o cerrar sesión; el layout cambia solo.

## Modelo de datos

- `public.usuarios`: una fila por usuario, la crea el trigger `crear_perfil_usuario` al registrarse.
  `tipo_usuario` es `CLIENTE` o `PRESTADOR`.
- `public.prestadores`: categoría, experiencia, herramientas propias y ruta de la identificación (solo prestadores).
- Storage: `avatares` (público, fotos de perfil) e `identificaciones` (privado).
- La colonia/zona del cliente se guarda en los metadatos del usuario de Supabase Auth.

## Cambios al unificar

- Se usa un solo tipo de cuenta en todo el código: `CLIENTE` / `PRESTADOR` (el front usaba `cliente` / `profesional`). En pantalla sigue diciendo "Busco servicios" / "Ofrezco servicios".
- Los datos del registro se mandan como los espera el trigger de la base (`nombre`, `tipo_usuario`, `telefono`...). Antes el front mandaba `nombre_completo` y `rol`, que la base ignoraba.
- Contraseña mínima de 8 caracteres en todos lados (el front pedía 6).
- Teléfono: de 10 a 15 dígitos, igual que la validación del perfil.
- Se eliminó `dashboard.tsx`: el inicio ahora es la pestaña `(tabs)/index.tsx`, que lee el perfil real de `public.usuarios`.
- La pestaña Perfil ya permite editar nombre, teléfono, fecha de nacimiento, tipo de cuenta, foto de perfil y (si eres prestador) la identificación.
- `supabase/02_sprint3_perfil.sql` es nuevo: el código ya lo mencionaba pero el archivo no venía en el proyecto.
- Carpetas en minúsculas (`components`, `services`) para evitar errores entre Windows, macOS y Linux.
- No se incluyó la carpeta `example/` (copia de la plantilla) ni las imágenes de ejemplo de Expo que no se usan.

## Pendiente

- Elegir la ubicación aproximada en el perfil (el servicio y la base ya la aceptan).
- Inicio de sesión con Google/Apple y recuperación de contraseña (los botones muestran "Próximamente").
- Publicar y rentar servicios.
