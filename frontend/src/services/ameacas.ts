import { z } from 'zod';
import { CATEGORIAS, SEVERIDADES, TIPOS_INDICADOR } from '@/constantes/ameacas';
import { obterJsonAutenticado } from './api';

const fonteSchema = z.object({ nome: z.string() }).nullable();

const indicadorSchema = z.object({
  id: z.uuid(),
  tipo: z.enum(TIPOS_INDICADOR),
  valor: z.string(),
  confianca: z.number(),
  primeiraVez: z.string(),
  ultimaVez: z.string(),
});

const ameacaSchema = z.object({
  id: z.uuid(),
  titulo: z.string(),
  descricao: z.string().nullable(),
  categoria: z.enum(CATEGORIAS),
  severidade: z.enum(SEVERIDADES),
  estadoVerificacao: z.string(),
  cveId: z.string().nullable(),
  urlFonte: z.string().nullable(),
  fonte: fonteSchema,
  publicadoEm: z.string().nullable(),
  coletadoEm: z.string(),
  ultimaVerificacao: z.string().nullable(),
});

const listaSchema = z.object({
  itens: z.array(ameacaSchema),
  pagina: z.number(),
  limite: z.number(),
  temMais: z.boolean(),
});

const detalheSchema = ameacaSchema.extend({ indicadores: z.array(indicadorSchema) });

export type Ameaca = z.infer<typeof ameacaSchema>;
export type DetalheAmeaca = z.infer<typeof detalheSchema>;
export type Indicador = z.infer<typeof indicadorSchema>;
export type ListaAmeacas = z.infer<typeof listaSchema>;

export interface FiltrosAmeacas {
  categoria?: string;
  severidade?: string;
  pagina: number;
  limite: number;
}

function montarQuery(filtros: FiltrosAmeacas): string {
  const parametros = new URLSearchParams({
    pagina: String(filtros.pagina),
    limite: String(filtros.limite),
  });
  if (filtros.categoria) {
    parametros.set('categoria', filtros.categoria);
  }
  if (filtros.severidade) {
    parametros.set('severidade', filtros.severidade);
  }
  return parametros.toString();
}

export async function listarAmeacas(token: string, filtros: FiltrosAmeacas): Promise<ListaAmeacas> {
  const corpo = await obterJsonAutenticado(`/api/v1/threats?${montarQuery(filtros)}`, token);
  return listaSchema.parse(corpo);
}

export async function buscarAmeaca(token: string, id: string): Promise<DetalheAmeaca> {
  const corpo = await obterJsonAutenticado(`/api/v1/threats/${encodeURIComponent(id)}`, token);
  return detalheSchema.parse(corpo);
}
