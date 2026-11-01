import { z } from 'zod';
import regrasJson from '../../config/risk-rules.json' with { type: 'json' };

const pesoSchema = z.number().min(0).max(100);

const regrasSchema = z.object({
  versao: z.string().min(1).max(40),
  incerteza: z.object({
    pontuacaoSemEvidencia: pesoSchema,
    tetoSemReputacao: pesoSchema,
  }),
  reputacao: z.object({
    janelaRecenteDias: z.number().int().positive(),
    fatorRecente: z.number().min(0).max(1),
    fatorAntigo: z.number().min(0).max(1),
    pontosPorConfiabilidade: z.number().positive(),
    confiabilidadeMinimaConfirmacao: z.number().int().min(1).max(5),
    pesoPorTipo: z.object({
      url: z.number().min(0),
      domain: z.number().min(0),
      ip: z.number().min(0),
    }),
  }),
  estrutura: z.object({
    limiarSuspeito: pesoSchema,
    comprimentoUrlLongo: z.number().int().positive(),
    minimoRotulosSubdominio: z.number().int().positive(),
    minimoHifens: z.number().int().positive(),
    palavrasIsca: z.array(z.string().min(1)).min(1),
    tldsSuspeitos: z.array(z.string().min(1)),
    pesos: z.object({
      ip_no_host: pesoSchema,
      dominio_punycode: pesoSchema,
      sem_tls: pesoSchema,
      subdominios_excessivos: pesoSchema,
      palavra_isca: pesoSchema,
      tld_suspeito: pesoSchema,
      url_longa: pesoSchema,
      hifens_excessivos: pesoSchema,
    }),
  }),
});

export type RegrasRisco = z.infer<typeof regrasSchema>;
export type IdRegraEstrutural = keyof RegrasRisco['estrutura']['pesos'];

/**
 * Regras carregadas e validadas uma vez, na inicialização do módulo.
 * Um arquivo malformado derruba o servidor cedo, em vez de gerar classificações erradas.
 */
export const REGRAS_RISCO: RegrasRisco = regrasSchema.parse(regrasJson);
