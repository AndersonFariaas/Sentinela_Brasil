import { describe, expect, it } from 'vitest';
import { avaliarRisco } from './motor.js';
import { REGRAS_RISCO } from './regras.js';
import type { CorrespondenciaReputacao, Evidencia } from './tipos.js';

const AGORA = new Date('2026-11-01T12:00:00.000Z');
const DIAS = 24 * 60 * 60 * 1000;

function correspondencia(
  sobrescrever: Partial<CorrespondenciaReputacao> = {},
): CorrespondenciaReputacao {
  return {
    tipo: 'url',
    valor: 'https://golpe.example/',
    fonte: 'Fonte de teste',
    confiabilidade: 5,
    ultimaVez: new Date(AGORA.getTime() - 10 * DIAS),
    ...sobrescrever,
  };
}

function evidenciaEstrutural(peso: number): Evidencia {
  return { grupo: 'E', id: 'teste', titulo: 'Teste', descricao: 'Teste', peso };
}

describe('avaliarRisco', () => {
  it('sem nenhuma evidência, usa a base de incerteza e não afirma segurança', () => {
    const avaliacao = avaliarRisco([], [], AGORA, REGRAS_RISCO);

    expect(avaliacao).toMatchObject({
      classificacao: 'nao_identificado',
      pontuacao: REGRAS_RISCO.incerteza.pontuacaoSemEvidencia,
      nivel: 'baixo',
      evidencias: [],
    });
  });

  it('sinais estruturais sem reputação ficam limitados ao teto de 39', () => {
    const avaliacao = avaliarRisco([], [evidenciaEstrutural(100)], AGORA, REGRAS_RISCO);

    expect(avaliacao.pontuacao).toBe(REGRAS_RISCO.incerteza.tetoSemReputacao);
    expect(avaliacao.nivel).toBe('moderado');
  });

  it('sinal estrutural forte classifica como suspeito, sem confirmar', () => {
    const avaliacao = avaliarRisco([], [evidenciaEstrutural(40)], AGORA, REGRAS_RISCO);

    expect(avaliacao.classificacao).toBe('suspeito');
  });

  it('sinal estrutural fraco não classifica como suspeito', () => {
    const avaliacao = avaliarRisco([], [evidenciaEstrutural(10)], AGORA, REGRAS_RISCO);

    expect(avaliacao.classificacao).toBe('nao_identificado');
  });

  it('correspondência recente de fonte confiável confirma a ameaça', () => {
    const avaliacao = avaliarRisco([correspondencia()], [], AGORA, REGRAS_RISCO);

    expect(avaliacao.classificacao).toBe('confirmado');
    // Confiabilidade 5 × 20 pontos × peso do tipo url (1) × recência (1) = 100.
    expect(avaliacao.pontuacao).toBe(100);
    expect(avaliacao.nivel).toBe('critico');
  });

  it('correspondência antiga de fonte confiável não confirma, mas ainda é suspeita', () => {
    const antiga = correspondencia({ ultimaVez: new Date(AGORA.getTime() - 200 * DIAS) });

    const avaliacao = avaliarRisco([antiga], [], AGORA, REGRAS_RISCO);

    expect(avaliacao.classificacao).toBe('suspeito');
    // 5 × 20 × 1 × fator antigo 0,6 = 60.
    expect(avaliacao.pontuacao).toBe(60);
  });

  it('correspondência de fonte de menor confiabilidade é suspeita, não confirmada', () => {
    const fraca = correspondencia({ confiabilidade: 3, tipo: 'domain' });

    const avaliacao = avaliarRisco([fraca], [], AGORA, REGRAS_RISCO);

    expect(avaliacao.classificacao).toBe('suspeito');
    // 3 × 20 × 1 × 1 = 60.
    expect(avaliacao.pontuacao).toBe(60);
  });

  it('combina R e E como maior + 0,5 × menor', () => {
    const avaliacao = avaliarRisco(
      [correspondencia({ confiabilidade: 3, tipo: 'domain' })],
      [evidenciaEstrutural(40)],
      AGORA,
      REGRAS_RISCO,
    );

    // maior(60, 40) + 0,5 × menor(60, 40) = 60 + 20 = 80.
    expect(avaliacao.pontuacao).toBe(80);
  });

  it('limita a pontuação combinada a 100', () => {
    const avaliacao = avaliarRisco(
      [correspondencia()],
      [evidenciaEstrutural(40)],
      AGORA,
      REGRAS_RISCO,
    );

    expect(avaliacao.pontuacao).toBe(100);
  });

  it('usa só o maior peso dentro do grupo R, nunca a soma', () => {
    const avaliacao = avaliarRisco(
      [
        correspondencia({ confiabilidade: 3, tipo: 'domain' }),
        correspondencia({ confiabilidade: 2, tipo: 'domain', valor: 'outro.example' }),
      ],
      [],
      AGORA,
      REGRAS_RISCO,
    );

    expect(avaliacao.pontuacao).toBe(60);
  });

  it('inclui todas as evidências, com o grupo de cada uma', () => {
    const avaliacao = avaliarRisco(
      [correspondencia()],
      [evidenciaEstrutural(40)],
      AGORA,
      REGRAS_RISCO,
    );

    expect(avaliacao.evidencias.map((evidencia) => evidencia.grupo)).toEqual(['R', 'E']);
  });

  it('é determinístico: a mesma entrada gera o mesmo resultado', () => {
    const entrada = [correspondencia({ confiabilidade: 4, tipo: 'domain' })];

    expect(avaliarRisco(entrada, [], AGORA, REGRAS_RISCO)).toEqual(
      avaliarRisco(entrada, [], AGORA, REGRAS_RISCO),
    );
  });
});
