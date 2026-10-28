// GET /api/openapi — Especificación OpenAPI 3 de la API
//   docs/openapi.json          Sprint 4 (categorías y publicaciones)
//   docs/openapi-sprint5.json  Sprint 5 (galería al editar), se une aquí

import especificacion from '../../../docs/openapi.json';
import sprint5 from '../../../docs/openapi-sprint5.json';
import { json } from '@/server/http';

const completa = {
  ...especificacion,
  info: { ...especificacion.info, title: 'Workeando API · Publicaciones (Sprints 4 y 5)' },
  tags: [...especificacion.tags, ...sprint5.tags],
  paths: { ...especificacion.paths, ...sprint5.paths },
  components: {
    ...especificacion.components,
    schemas: { ...especificacion.components.schemas, ...sprint5.schemas },
  },
};

export function GET() {
  return json(completa);
}