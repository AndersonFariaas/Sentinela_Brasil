import { z } from 'zod';
import { CLASSIFICACOES } from '@/constantes/scanner';
import { SEVERIDADES } from '@/constantes/ameacas';
import { ErroApi, enviarJsonAutenticado, excluirAutenticado, obterJsonAutenticado } from './api';

const evidenciaSchema = z.object({
  grupo: z.enum(['R', 'E']),
  id: z.string(),
  titulo: z.string(),
  descricao: z.string(),
  peso: z.number(),
});

const fonteSchema = z.object({
  nome: z.string(),
  status: z.string(),
  correspondencias: z.number(),
});

const analiseSchema = z.object({
  status: z.enum(['ok', 'fallback']),
  modelo: z.string().nullable(),
  evidenciasCitadas: z.array(z.string()),
  resumo: z.string(),
  justificativa: z.string(),
  recomendacoes: z.array(z.string()),
});

const scanSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  host: z.string(),
  classificacao: z.enum(CLASSIFICACOES),
  pontuacao: z.number().int().min(0).max(100),
  nivel: z.enum(SEVERIDADES),
  criadaEm: z.string(),
  evidencias: z.array(evidenciaSchema),
  fontes: z.array(fonteSchema),
  analise: analiseSchema,
  algoritmo: z.string(),
});

export type Scan = z.infer<typeof scanSchema>;
export type Evidencia = z.infer<typeof evidenciaSchema>;

/** A URL foi recusada pelo servidor. A mensagem já vem pronta para o usuário. */
export class ErroUrlRecusada extends Error {
  constructor(readonly mensagem: string) {
    super(mensagem);
    this.name = 'ErroUrlRecusada';
  }
}

/**
 * Envia a URL para análise. Devolve o resultado validado.
 * Lança ErroUrlRecusada quando o servidor recusa a entrada (400 URL_INVALIDA).
 */
export async function criarAnalise(token: string, url: string): Promise<Scan> {
  try {
    const corpo = await enviarJsonAutenticado('/api/v1/scans', token, { url });
    return scanSchema.parse(corpo);
  } catch (falha) {
    if (falha instanceof ErroApi && falha.status === 400 && falha.detalhe) {
      throw new ErroUrlRecusada(falha.detalhe);
    }
    throw falha;
  }
}

/** Busca um resultado já salvo. Lança ErroApi (404 quando não existe ou não é do usuário). */
export async function buscarAnalise(token: string, id: string): Promise<Scan> {
  const corpo = await obterJsonAutenticado(`/api/v1/scans/${encodeURIComponent(id)}`, token);
  return scanSchema.parse(corpo);
}

const resumoAnaliseSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  host: z.string(),
  classificacao: z.enum(CLASSIFICACOES),
  pontuacao: z.number().int().min(0).max(100),
  nivel: z.enum(SEVERIDADES),
  criadaEm: z.string(),
});

const historicoSchema = z.object({
  itens: z.array(resumoAnaliseSchema),
  pagina: z.number().int(),
  limite: z.number().int(),
  temMais: z.boolean(),
});

export type ResumoAnalise = z.infer<typeof resumoAnaliseSchema>;
export type Historico = z.infer<typeof historicoSchema>;

/** Uma página do histórico do usuário, do mais recente para o mais antigo. */
export async function listarHistorico(
  token: string,
  pagina: number,
  limite: number,
): Promise<Historico> {
  const parametros = new URLSearchParams({ pagina: String(pagina), limite: String(limite) });
  const corpo = await obterJsonAutenticado(`/api/v1/scans?${parametros.toString()}`, token);
  return historicoSchema.parse(corpo);
}

/** Exclui uma análise do histórico. Lança ErroApi (404 quando já não existe). */
export async function excluirAnalise(token: string, id: string): Promise<void> {
  await excluirAutenticado(`/api/v1/scans/${encodeURIComponent(id)}`, token);
}
