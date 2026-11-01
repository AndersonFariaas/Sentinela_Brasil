import type { RegrasRisco } from './regras.js';
import type { Classificacao, CorrespondenciaReputacao, Evidencia, NivelRisco } from './tipos.js';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

const NOMES_TIPO = { url: 'URL', domain: 'domínio', ip: 'endereço IP' } as const;

export interface AvaliacaoGeral {
  classificacao: Classificacao;
  pontuacao: number;
  nivel: NivelRisco;
  evidencias: Evidencia[];
}

interface SinalReputacao {
  correspondencia: CorrespondenciaReputacao;
  recente: boolean;
  pontos: number;
}

function ehRecente(ultimaVez: Date, agora: Date, regras: RegrasRisco): boolean {
  const idadeEmDias = (agora.getTime() - ultimaVez.getTime()) / MS_POR_DIA;
  return idadeEmDias <= regras.reputacao.janelaRecenteDias;
}

/**
 * Pontos de uma correspondência: confiabilidade × peso do tipo × recência.
 * Dentro do grupo R só o maior valor entra na pontuação, nunca a soma.
 */
export function pontuarReputacao(
  correspondencia: CorrespondenciaReputacao,
  agora: Date,
  regras: RegrasRisco,
): SinalReputacao {
  const { reputacao } = regras;
  const recente = ehRecente(correspondencia.ultimaVez, agora, regras);
  const fatorRecencia = recente ? reputacao.fatorRecente : reputacao.fatorAntigo;
  const pontos =
    correspondencia.confiabilidade *
    reputacao.pontosPorConfiabilidade *
    reputacao.pesoPorTipo[correspondencia.tipo] *
    fatorRecencia;

  return { correspondencia, recente, pontos: Math.round(pontos) };
}

function evidenciaReputacao(
  { correspondencia, recente, pontos }: SinalReputacao,
  regras: RegrasRisco,
): Evidencia {
  const { tipo, valor, fonte, confiabilidade } = correspondencia;
  const janela = regras.reputacao.janelaRecenteDias;
  const periodo = recente
    ? `nos últimos ${String(janela)} dias`
    : `há mais de ${String(janela)} dias`;

  return {
    grupo: 'R',
    id: `reputacao-${tipo}`,
    titulo: `Correspondência com ${NOMES_TIPO[tipo]} de fonte conhecida`,
    descricao: `O indicador "${valor}", da fonte ${fonte} (confiabilidade ${String(confiabilidade)} de 5), foi visto ${periodo}.`,
    peso: pontos,
  };
}

function nivelPara(pontuacao: number): NivelRisco {
  if (pontuacao < 20) return 'baixo';
  if (pontuacao < 40) return 'moderado';
  if (pontuacao < 70) return 'alto';
  return 'critico';
}

function classificar(
  sinais: SinalReputacao[],
  pesoEstrutural: number,
  regras: RegrasRisco,
): Classificacao {
  const confirmado = sinais.some(
    ({ correspondencia, recente }) =>
      recente && correspondencia.confiabilidade >= regras.reputacao.confiabilidadeMinimaConfirmacao,
  );
  if (confirmado) return 'confirmado';

  const suspeito = sinais.length > 0 || pesoEstrutural >= regras.estrutura.limiarSuspeito;
  return suspeito ? 'suspeito' : 'nao_identificado';
}

/**
 * Motor determinístico: mesma entrada, mesmo resultado. A IA não altera nada aqui.
 * Pontuação = maior(R, E) + 0,5 × menor(R, E), limitada a 100.
 */
export function avaliarRisco(
  correspondencias: CorrespondenciaReputacao[],
  evidenciasEstruturais: Evidencia[],
  agora: Date,
  regras: RegrasRisco,
): AvaliacaoGeral {
  const sinais = correspondencias.map((c) => pontuarReputacao(c, agora, regras));
  const evidenciasReputacao = sinais.map((sinal) => evidenciaReputacao(sinal, regras));

  const pontosR = Math.max(0, ...sinais.map((s) => s.pontos));
  const pontosE = Math.max(0, ...evidenciasEstruturais.map((e) => e.peso));
  const pontuacao = calcularPontuacao(pontosR, pontosE, regras);

  return {
    classificacao: classificar(sinais, pontosE, regras),
    pontuacao,
    nivel: nivelPara(pontuacao),
    evidencias: [...evidenciasReputacao, ...evidenciasEstruturais],
  };
}

function calcularPontuacao(pontosR: number, pontosE: number, regras: RegrasRisco): number {
  const { incerteza } = regras;

  // Sem nenhuma evidência, a base de incerteza representa falta de informação, não segurança.
  if (pontosR === 0 && pontosE === 0) {
    return incerteza.pontuacaoSemEvidencia;
  }

  const combinada = Math.max(pontosR, pontosE) + 0.5 * Math.min(pontosR, pontosE);
  const limitada = Math.min(100, Math.round(combinada));

  // Sem reputação, sinais estruturais não bastam para afirmar risco alto.
  return pontosR === 0 ? Math.min(limitada, incerteza.tetoSemReputacao) : limitada;
}
