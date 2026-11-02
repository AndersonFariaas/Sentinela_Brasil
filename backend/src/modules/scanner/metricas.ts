import type { Classificacao } from './tipos.js';

/** Resultado de uma URL do conjunto rotulado, depois de passar pelo pipeline real. */
export interface AmostraAvaliada {
  /** Rótulo do analista: a URL é perigosa? */
  perigosa: boolean;
  /** Pela regra do produto, a URL devia ser recusada na validação (privada ou malformada). */
  deveRecusar: boolean;
  recusada: boolean;
  /** O motivo da recusa bate com o esperado no rótulo. Só se aplica a recusas. */
  motivoCorreto: boolean;
  classificacao: Classificacao | null;
  tempoMs: number | null;
}

export interface MetricasMotor {
  total: number;
  /** Recusadas e que deviam ser recusadas. */
  recusasCorretas: number;
  /** Recusadas e que deviam ser analisadas. */
  recusasIndevidas: number;
  /** Aceitas e que deviam ser recusadas. Falha de validação. */
  aceitasIndevidamente: number;
  recusasComMotivoDiferente: number;
  analisadas: number;
  verdadeirosPositivos: number;
  falsosPositivos: number;
  verdadeirosNegativos: number;
  falsosNegativos: number;
  precisao: number | null;
  recall: number | null;
  taxaFalsoPositivo: number | null;
  acuracia: number | null;
  tempoMedianoMs: number | null;
  tempoMaximoMs: number | null;
}

const CLASSIFICACOES_POSITIVAS: ReadonlySet<Classificacao> = new Set(['suspeito', 'confirmado']);

/** Divisão que devolve null sem base, em vez de NaN ou de um zero enganoso. */
function razao(numerador: number, denominador: number): number | null {
  return denominador === 0 ? null : numerador / denominador;
}

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;

  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  if (ordenados.length % 2 === 1) return ordenados[meio] ?? null;

  return ((ordenados[meio - 1] ?? 0) + (ordenados[meio] ?? 0)) / 2;
}

function ehPredicaoPositiva(amostra: AmostraAvaliada): boolean {
  return amostra.classificacao !== null && CLASSIFICACOES_POSITIVAS.has(amostra.classificacao);
}

/**
 * Compara o resultado do motor com o rótulo do analista.
 * Só URLs analisadas entram na matriz de confusão. Recusas são medidas à parte, porque
 * uma recusa correta não é uma classificação.
 */
export function calcularMetricas(amostras: AmostraAvaliada[]): MetricasMotor {
  const recusadas = amostras.filter((a) => a.recusada);
  const analisadas = amostras.filter((a) => !a.recusada);

  const positivasPreditas = analisadas.filter(ehPredicaoPositiva);
  const negativasPreditas = analisadas.filter((a) => !ehPredicaoPositiva(a));

  const verdadeirosPositivos = positivasPreditas.filter((a) => a.perigosa).length;
  const falsosPositivos = positivasPreditas.length - verdadeirosPositivos;
  const verdadeirosNegativos = negativasPreditas.filter((a) => !a.perigosa).length;
  const falsosNegativos = negativasPreditas.length - verdadeirosNegativos;

  const tempos = analisadas.flatMap((a) => (a.tempoMs === null ? [] : [a.tempoMs]));

  return {
    total: amostras.length,
    recusasCorretas: recusadas.filter((a) => a.deveRecusar).length,
    recusasIndevidas: recusadas.filter((a) => !a.deveRecusar).length,
    aceitasIndevidamente: analisadas.filter((a) => a.deveRecusar).length,
    recusasComMotivoDiferente: recusadas.filter((a) => a.deveRecusar && !a.motivoCorreto).length,
    analisadas: analisadas.length,
    verdadeirosPositivos,
    falsosPositivos,
    verdadeirosNegativos,
    falsosNegativos,
    precisao: razao(verdadeirosPositivos, verdadeirosPositivos + falsosPositivos),
    recall: razao(verdadeirosPositivos, verdadeirosPositivos + falsosNegativos),
    taxaFalsoPositivo: razao(falsosPositivos, falsosPositivos + verdadeirosNegativos),
    acuracia: razao(verdadeirosPositivos + verdadeirosNegativos, analisadas.length),
    tempoMedianoMs: mediana(tempos),
    tempoMaximoMs: tempos.length === 0 ? null : Math.max(...tempos),
  };
}
