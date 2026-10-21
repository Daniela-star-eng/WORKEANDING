// src/lib/publicaciones/validadores.ts — Validación de publicaciones con Chain of Responsibility
//
// Cada validador revisa UNA regla y pasa el contexto al siguiente eslabón.
// Para agregar una regla nueva basta con crear otra clase y enlazarla en la cadena,
// sin tocar las demás (ver "Patrones seleccionados" en la planeación).
//
// Esta cadena es TypeScript puro: la usa la API (src/app/api/publications+api.ts)
// y también puede usarla el formulario de la app para mostrar errores al instante.

import {
    REGLAS,
    UNIDADES_PRECIO,
    type CampoPublicacion,
    type CodigoError,
    type ErroresPublicacion,
    type NuevaPublicacion,
  } from './tipos';
  
  // ---------------------------------------------------------------------
  // Infraestructura de la cadena
  // ---------------------------------------------------------------------
  
  export type ContextoValidacion = {
    /** Datos ya normalizados (espacios recortados, tipos convertidos) */
    datos: NuevaPublicacion;
    errores: ErroresPublicacion;
    avisos: string[];
    /** Si un eslabón detecta algo grave puede cortar la cadena con un error general */
    fallo: { estado: number; codigo: CodigoError; mensaje: string } | null;
    /** La publicación tiene contenido que debe revisar un moderador */
    requiereRevision: boolean;
  };
  
  export abstract class Validador {
    private siguiente: Validador | null = null;
  
    /** Enlaza el siguiente validador y lo regresa para poder encadenar: a.enlazar(b).enlazar(c) */
    enlazar(siguiente: Validador): Validador {
      this.siguiente = siguiente;
      return siguiente;
    }
  
    async manejar(ctx: ContextoValidacion): Promise<void> {
      await this.validar(ctx);
      if (!ctx.fallo && this.siguiente) await this.siguiente.manejar(ctx);
    }
  
    protected abstract validar(ctx: ContextoValidacion): void | Promise<void>;
  
    /** Registra solo el primer error de cada campo */
    protected error(ctx: ContextoValidacion, campo: CampoPublicacion, mensaje: string) {
      if (!ctx.errores[campo]) ctx.errores[campo] = mensaje;
    }
  }
  
  /** Une los validadores en el orden recibido y regresa el primero. */
  export function construirCadena(...validadores: Validador[]): Validador {
    validadores.reduce((anterior, actual) => anterior.enlazar(actual));
    return validadores[0];
  }
  
  /** Ejecuta la cadena y regresa el contexto con errores, avisos y fallo (si hubo). */
  export async function ejecutarCadena(
    cadena: Validador,
    datos: NuevaPublicacion
  ): Promise<ContextoValidacion> {
    const ctx: ContextoValidacion = {
      datos,
      errores: {},
      avisos: [],
      fallo: null,
      requiereRevision: false,
    };
    await cadena.manejar(ctx);
    return ctx;
  }
  
  // ---------------------------------------------------------------------
  // Normalización del cuerpo recibido (JSON desconocido -> NuevaPublicacion)
  // ---------------------------------------------------------------------
  
  function aNumero(valor: unknown): number {
    if (typeof valor === 'number') return valor;
    if (typeof valor === 'string' && valor.trim() !== '' && !Number.isNaN(Number(valor))) {
      return Number(valor);
    }
    return Number.NaN;
  }
  
  /**
   * Convierte el cuerpo de la petición en una NuevaPublicacion.
   * Los valores con tipo incorrecto quedan como NaN / '' para que la cadena los reporte.
   */
  export function normalizarEntrada(cuerpo: unknown): NuevaPublicacion | null {
    if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return null;
    const c = cuerpo as Record<string, unknown>;
  
    const texto = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
    const ubicacion = (v: unknown) => (v === undefined || v === null || v === '' ? null : aNumero(v));
  
    const precio = aNumero(c.precio);
  
    return {
      titulo: texto(c.titulo),
      descripcion: typeof c.descripcion === 'string' ? c.descripcion.trim() : '',
      // Se guarda con 2 decimales (igual que la BD)
      precio: Number.isFinite(precio) ? Math.round(precio * 100) / 100 : precio,
      unidad_precio: (typeof c.unidad_precio === 'string'
        ? c.unidad_precio.trim().toUpperCase()
        : 'DIA') as NuevaPublicacion['unidad_precio'],
      categoria_id: aNumero(c.categoria_id),
      imagenes: Array.isArray(c.imagenes)
        ? c.imagenes.map((i) => (typeof i === 'string' ? i.trim() : ''))
        : [],
      latitud: ubicacion(c.latitud),
      longitud: ubicacion(c.longitud),
    };
  }
  
  // ---------------------------------------------------------------------
  // Eslabones (reglas que no necesitan base de datos)
  // ---------------------------------------------------------------------
  
  export class ValidadorTitulo extends Validador {
    protected validar(ctx: ContextoValidacion) {
      const { titulo } = ctx.datos;
      if (!titulo) this.error(ctx, 'titulo', 'Escribe un título.');
      else if (titulo.length < REGLAS.TITULO_MIN) {
        this.error(ctx, 'titulo', `El título debe tener al menos ${REGLAS.TITULO_MIN} caracteres.`);
      } else if (titulo.length > REGLAS.TITULO_MAX) {
        this.error(ctx, 'titulo', `El título no puede tener más de ${REGLAS.TITULO_MAX} caracteres.`);
      }
    }
  }
  
  export class ValidadorDescripcion extends Validador {
    protected validar(ctx: ContextoValidacion) {
      const { descripcion } = ctx.datos;
      if (!descripcion) this.error(ctx, 'descripcion', 'Escribe una descripción.');
      else if (descripcion.length < REGLAS.DESCRIPCION_MIN) {
        this.error(
          ctx,
          'descripcion',
          `La descripción debe tener al menos ${REGLAS.DESCRIPCION_MIN} caracteres.`
        );
      } else if (descripcion.length > REGLAS.DESCRIPCION_MAX) {
        this.error(
          ctx,
          'descripcion',
          `La descripción no puede tener más de ${REGLAS.DESCRIPCION_MAX} caracteres.`
        );
      }
    }
  }
  
  export class ValidadorPrecio extends Validador {
    protected validar(ctx: ContextoValidacion) {
      const { precio, unidad_precio } = ctx.datos;
      if (!Number.isFinite(precio)) this.error(ctx, 'precio', 'El precio debe ser un número.');
      else if (precio <= 0) this.error(ctx, 'precio', 'El precio debe ser mayor a 0.');
      else if (precio > REGLAS.PRECIO_MAX) {
        this.error(ctx, 'precio', 'El precio no puede ser mayor a 999,999.99.');
      }
  
      if (!UNIDADES_PRECIO.includes(unidad_precio as (typeof UNIDADES_PRECIO)[number])) {
        this.error(ctx, 'unidad_precio', `La unidad de precio debe ser ${UNIDADES_PRECIO.join(', ')}.`);
      }
    }
  }
  
  export class ValidadorCategoriaFormato extends Validador {
    protected validar(ctx: ContextoValidacion) {
      const { categoria_id } = ctx.datos;
      if (!Number.isInteger(categoria_id) || categoria_id <= 0) {
        this.error(ctx, 'categoria_id', 'Selecciona una categoría.');
      }
    }
  }
  
  export class ValidadorUbicacion extends Validador {
    protected validar(ctx: ContextoValidacion) {
      const { latitud, longitud } = ctx.datos;
      if ((latitud == null) !== (longitud == null)) {
        this.error(ctx, 'ubicacion', 'La ubicación debe incluir latitud y longitud.');
        return;
      }
      if (latitud == null || longitud == null) return; // se usará la del perfil
      if (
        !Number.isFinite(latitud) ||
        !Number.isFinite(longitud) ||
        latitud < -90 ||
        latitud > 90 ||
        longitud < -180 ||
        longitud > 180
      ) {
        this.error(ctx, 'ubicacion', 'La ubicación no es válida.');
      }
    }
  }
  
  const RUTA_IMAGEN = /^[0-9a-f-]{36}\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/i;
  
  export class ValidadorImagenesFormato extends Validador {
    protected validar(ctx: ContextoValidacion) {
      const { imagenes } = ctx.datos;
      if (imagenes.length < REGLAS.IMAGENES_MIN) {
        this.error(ctx, 'imagenes', 'Agrega al menos una fotografía.');
      } else if (imagenes.length > REGLAS.IMAGENES_MAX) {
        this.error(ctx, 'imagenes', `Puedes agregar máximo ${REGLAS.IMAGENES_MAX} fotografías.`);
      } else if (imagenes.some((ruta) => !RUTA_IMAGEN.test(ruta))) {
        this.error(ctx, 'imagenes', 'Alguna fotografía no tiene una ruta válida.');
      } else if (new Set(imagenes).size !== imagenes.length) {
        this.error(ctx, 'imagenes', 'Hay fotografías repetidas.');
      }
    }
  }
  
  /**
   * Moderación básica (Problema 4 · productos ilegales).
   * No rechaza: marca la publicación para revisión. La BD aplica la misma lista
   * (tabla terminos_restringidos) y es la que decide estado_moderacion (APROBADA o PENDIENTE).
   */
  export const TERMINOS_RESTRINGIDOS = [
    'arma', 'armas', 'pistola', 'rifle', 'escopeta', 'municion', 'municiones',
    'droga', 'drogas', 'marihuana', 'cocaina', 'cristal',
    'explosivo', 'explosivos', 'pirotecnia', 'cohetes',
    'medicamento controlado', 'receta medica',
    'documento falso', 'identificacion falsa', 'placas falsas',
  ];
  
  export function normalizarTexto(texto: string): string {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }
  
  export function contieneTerminoRestringido(texto: string): boolean {
    const limpio = normalizarTexto(texto);
    return TERMINOS_RESTRINGIDOS.some((t) => new RegExp(`(^|[^a-z0-9])${t}($|[^a-z0-9])`).test(limpio));
  }
  
  export class ValidadorContenidoRestringido extends Validador {
    protected validar(ctx: ContextoValidacion) {
      if (contieneTerminoRestringido(`${ctx.datos.titulo} ${ctx.datos.descripcion}`)) {
        ctx.requiereRevision = true;
        ctx.avisos.push(
          'Tu publicación quedará en revisión porque menciona productos o servicios restringidos.'
        );
      }
    }
  }
  
  /** Cadena base: reglas de formato que también puede usar el formulario de la app. */
  export function cadenaBasePublicacion(): Validador {
    return construirCadena(
      new ValidadorTitulo(),
      new ValidadorDescripcion(),
      new ValidadorPrecio(),
      new ValidadorCategoriaFormato(),
      new ValidadorUbicacion(),
      new ValidadorImagenesFormato(),
      new ValidadorContenidoRestringido()
    );
  }
  
  /** Atajo para el formulario: valida sin base de datos y regresa los errores por campo. */
  export async function validarPublicacionLocal(datos: NuevaPublicacion) {
    return ejecutarCadena(cadenaBasePublicacion(), datos);
  }