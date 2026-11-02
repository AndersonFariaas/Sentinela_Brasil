import type { Classificacao, Evidencia, FonteConsultada, NivelRisco } from '../scanner/tipos.js';
import { validarRespostaIa, type MotivoRejeicaoIa } from './contrato.js';
import { montarMensagemUsuario, PROMPT_SISTEMA, VERSAO_PROMPT } from './prompt.js';
import { ErroProvedorIa, type ProvedorIa } from './provedor.js';

export type MotivoFallbackIa =
  'desativada' | 'tempo_esgotado' | 'recusa' | 'erro_provedor' | MotivoRejeicaoIa;

export interface EntradaAnaliseIa {
  classificacao: Classificacao;
  pontuacao: number;
  nivel: NivelRisco;
  host: string;
  evidencias: Evidencia[];
  fontes: FonteConsultada[];
}

export interface ExplicacaoIa {
  resumo: string;
  justificativa: string;
  recomendacoes: string[];
  evidenciasCitadas: string[];
}

export type ResultadoAnaliseIa =
  | {
      status: 'ok';
      explicacao: ExplicacaoIa;
      provedor: string;
      modelo: string;
      versaoPrompt: string;
    }
  | { status: 'fallback'; motivo: MotivoFallbackIa };

export interface OpcoesAnaliseIa {
  /** Null quando não há chave configurada: o resultado vira fallback sem chamada. */
  provedor: ProvedorIa | null;
  timeoutMs: number;
}

/**
 * Pede a explicação ao modelo. Qualquer falha (chave ausente, tempo, recusa, erro, resposta
 * inválida ou contraditória) devolve fallback. Nunca lança erro para quem chama.
 */
export async function analisarComIa(
  opcoes: OpcoesAnaliseIa,
  entrada: EntradaAnaliseIa,
): Promise<ResultadoAnaliseIa> {
  const { provedor, timeoutMs } = opcoes;
  if (!provedor) {
    return { status: 'fallback', motivo: 'desativada' };
  }

  const controle = new AbortController();
  const relogio = setTimeout(() => {
    controle.abort();
  }, timeoutMs);

  let texto: string;
  try {
    texto = await provedor.gerarTexto({
      sistema: PROMPT_SISTEMA,
      usuario: montarMensagemUsuario(entrada),
      signal: controle.signal,
    });
  } catch (falha) {
    if (controle.signal.aborted) {
      return { status: 'fallback', motivo: 'tempo_esgotado' };
    }
    if (falha instanceof ErroProvedorIa) {
      return { status: 'fallback', motivo: falha.motivo };
    }
    return { status: 'fallback', motivo: 'erro_provedor' };
  } finally {
    clearTimeout(relogio);
  }

  const validacao = validarRespostaIa(texto, entrada);
  if (!validacao.ok) {
    return { status: 'fallback', motivo: validacao.motivo };
  }

  return {
    status: 'ok',
    explicacao: validacao.resposta,
    provedor: provedor.nome,
    modelo: provedor.modelo,
    versaoPrompt: VERSAO_PROMPT,
  };
}
