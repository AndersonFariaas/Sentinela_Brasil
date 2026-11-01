import { z } from 'zod';
import { CATEGORIAS_AMEACA, SEVERIDADES, TIPOS_INDICADOR } from '../intelligence/tipos.js';

const LIMITE_PADRAO = 20;
const LIMITE_MAXIMO = 100;
const PAGINA_MAXIMA = 10_000;

const paginacaoSchema = {
  limite: z.coerce.number().int().min(1).max(LIMITE_MAXIMO).default(LIMITE_PADRAO),
  pagina: z.coerce.number().int().min(0).max(PAGINA_MAXIMA).default(0),
};

export const consultaAmeacasSchema = z.object({
  categoria: z.enum(CATEGORIAS_AMEACA).optional(),
  severidade: z.enum(SEVERIDADES).optional(),
  ...paginacaoSchema,
});

export const consultaIndicadoresSchema = z.object({
  tipo: z.enum(TIPOS_INDICADOR).optional(),
  ...paginacaoSchema,
});

export const parametroIdSchema = z.object({
  id: z.uuid(),
});
