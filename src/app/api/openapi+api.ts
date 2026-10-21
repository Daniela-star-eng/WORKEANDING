// GET /api/openapi — Especificación OpenAPI 3 de la API (docs/openapi.json)

import especificacion from '../../../docs/openapi.json';
import { json } from '@/server/http';

export function GET() {
  return json(especificacion);
}