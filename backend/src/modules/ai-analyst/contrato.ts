import { z } from 'zod';
import type { Classificacao, Evidencia } from '../scanner/tipos.js';

export const LIMITES_RESPOSTA = {
  resumo: 400,
  justificativa: 800,
  recomendacao: 200,
  recomendacoes: 5,
  evidencias: 50,
} as const;

/** Formato que o modelo deve devolver. Campos extras são recusados. */
export const respostaIaSchema = z
  .object({
    resumo: z.string().min(1).max(LIMITES_RESPOSTA.resumo),
    justificativa: z.string().min(1).max(LIMITES_RESPOSTA.justificativa),
    recomendacoes: z
      .array(z.string().min(1).max(LIMITES_RESPOSTA.recomendacao))
      .min(1)
      .max(LIMITES_RESPOSTA.recomendacoes),
    evidenciasCitadas: z.array(z.string()).max(LIMITES_RESPOSTA.evidencias),
  })
  .strict();

export type RespostaIa = z.infer<typeof respostaIaSchema>;

export const MOTIVOS_REJEICAO_IA = [
  'formato',
  'contrato',
  'evidencia_desconhecida',
  'contradicao',
] as const;

export type MotivoRejeicaoIa = (typeof MOTIVOS_REJEICAO_IA)[number];

export interface ContextoValidacao {
  classificacao: Classificacao;
  pontuacao: number;
  evidencias: Evidencia[];
}

export type ResultadoValidacaoIa =
  { ok: true; resposta: RespostaIa } | { ok: false; motivo: MotivoRejeicaoIa };

// Termos que afirmam segurança. Nosso produto nunca afirma isso (ver docs/security.md).
const AFIRMACOES_DE_SEGURANCA =
  /\bsegur[oa]s?\b|\bsem risco\b|\bnão há risco\b|\bnão representa risco\b/i;
const AFIRMACOES_DE_LEGITIMIDADE = /\blegítim[oa]s?\b/i;
const PONTUACAO_MENCIONADA = /(\d{1,3})\s*(?:de|\/)\s*100\b/g;

/** Aceita o JSON puro ou dentro de uma cerca de código (```json ... ```), comum em modelos. */
function extrairCorpoJson(texto: string): string {
  const aparado = texto.trim();
  const cerca = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(aparado);
  return cerca?.[1] ?? aparado;
}

function pontuacoesMencionadas(texto: string): number[] {
  return [...texto.matchAll(PONTUACAO_MENCIONADA)].map((casa) => Number(casa[1]));
}

/**
 * Valida a resposta do modelo contra o contrato e contra o motor.
 * Qualquer violação vira fallback: a IA não tem a última palavra sobre o resultado.
 */
export function validarRespostaIa(
  textoBruto: string,
  contexto: ContextoValidacao,
): ResultadoValidacaoIa {
  let corpo: unknown;
  try {
    corpo = JSON.parse(extrairCorpoJson(textoBruto));
  } catch {
    return { ok: false, motivo: 'formato' };
  }

  const analise = respostaIaSchema.safeParse(corpo);
  if (!analise.success) {
    return { ok: false, motivo: 'contrato' };
  }

  const resposta = analise.data;
  const idsConhecidos = new Set(contexto.evidencias.map((evidencia) => evidencia.id));
  if (resposta.evidenciasCitadas.some((id) => !idsConhecidos.has(id))) {
    return { ok: false, motivo: 'evidencia_desconhecida' };
  }

  const texto = [resposta.resumo, resposta.justificativa, ...resposta.recomendacoes].join('\n');
  if (AFIRMACOES_DE_SEGURANCA.test(texto)) {
    return { ok: false, motivo: 'contradicao' };
  }

  // Quando o motor não confirma legitimidade, a IA também não pode afirmá-la.
  const legitimidadeAfirmada = AFIRMACOES_DE_LEGITIMIDADE.test(texto);
  if (contexto.classificacao !== 'nao_identificado' && legitimidadeAfirmada) {
    return { ok: false, motivo: 'contradicao' };
  }

  if (pontuacoesMencionadas(texto).some((valor) => valor !== contexto.pontuacao)) {
    return { ok: false, motivo: 'contradicao' };
  }

  return { ok: true, resposta };
}
