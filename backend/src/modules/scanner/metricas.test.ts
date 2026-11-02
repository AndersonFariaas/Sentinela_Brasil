import { describe, expect, it } from 'vitest';
import { type AmostraAvaliada, calcularMetricas } from './metricas.js';

function analisada(
  perigosa: boolean,
  classificacao: AmostraAvaliada['classificacao'],
  tempoMs: number | null = 1,
): AmostraAvaliada {
  return {
    perigosa,
    deveRecusar: false,
    recusada: false,
    motivoCorreto: true,
    classificacao,
    tempoMs,
  };
}

function recusada(deveRecusar: boolean, motivoCorreto = true): AmostraAvaliada {
  return {
    perigosa: false,
    deveRecusar,
    recusada: true,
    motivoCorreto,
    classificacao: null,
    tempoMs: null,
  };
}

describe('calcularMetricas', () => {
  it('monta a matriz de confusão a partir de classificação positiva ou negativa', () => {
    const metricas = calcularMetricas([
      analisada(true, 'confirmado'), // VP
      analisada(true, 'suspeito'), // VP
      analisada(true, 'nao_identificado'), // FN
      analisada(false, 'suspeito'), // FP
      analisada(false, 'nao_identificado'), // VN
      analisada(false, 'nao_identificado'), // VN
    ]);

    expect(metricas).toMatchObject({
      verdadeirosPositivos: 2,
      falsosPositivos: 1,
      verdadeirosNegativos: 2,
      falsosNegativos: 1,
      precisao: 2 / 3,
      recall: 2 / 3,
      taxaFalsoPositivo: 1 / 3,
      acuracia: 4 / 6,
    });
  });

  it('separa recusas corretas, indevidas e aceitas indevidamente, sem contar recusa como classificação', () => {
    const metricas = calcularMetricas([
      recusada(true), // recusa correta
      recusada(false), // recusa indevida
      { ...analisada(false, 'nao_identificado'), deveRecusar: true }, // aceita indevidamente
      recusada(true, false), // recusou, mas pelo motivo errado
    ]);

    expect(metricas).toMatchObject({
      total: 4,
      recusasCorretas: 2,
      recusasIndevidas: 1,
      aceitasIndevidamente: 1,
      recusasComMotivoDiferente: 1,
      analisadas: 1,
    });
  });

  it('devolve null nas razões sem base, em vez de zero ou NaN', () => {
    const semPositivas = calcularMetricas([analisada(false, 'nao_identificado')]);

    expect(semPositivas.precisao).toBeNull();
    expect(semPositivas.recall).toBeNull();
    expect(semPositivas.taxaFalsoPositivo).toBe(0);
  });

  it('calcula mediana com número par e ímpar de amostras, e o máximo', () => {
    const impar = calcularMetricas([
      analisada(false, 'nao_identificado', 5),
      analisada(false, 'nao_identificado', 1),
      analisada(false, 'nao_identificado', 3),
    ]);
    const par = calcularMetricas([
      analisada(false, 'nao_identificado', 1),
      analisada(false, 'nao_identificado', 2),
      analisada(false, 'nao_identificado', 4),
      analisada(false, 'nao_identificado', 10),
    ]);

    expect(impar).toMatchObject({ tempoMedianoMs: 3, tempoMaximoMs: 5 });
    expect(par).toMatchObject({ tempoMedianoMs: 3, tempoMaximoMs: 10 });
  });

  it('não inventa tempo quando nada foi analisado', () => {
    expect(calcularMetricas([recusada(true)])).toMatchObject({
      tempoMedianoMs: null,
      tempoMaximoMs: null,
    });
  });
});
