import { describe, expect, it } from 'vitest';
import { validarRespostaIa, type ContextoValidacao } from './contrato.js';

const EVIDENCIA = {
  grupo: 'E' as const,
  id: 'palavra_isca',
  titulo: 'Palavras típicas de isca',
  descricao: 'Descrição de teste.',
  peso: 25,
};

const CONTEXTO: ContextoValidacao = {
  classificacao: 'suspeito',
  pontuacao: 25,
  evidencias: [EVIDENCIA],
};

function respostaValida(sobrescrever: Record<string, unknown> = {}): string {
  return JSON.stringify({
    resumo: 'A URL usa palavras comuns em páginas de golpe.',
    justificativa: 'Pontuação 25 de 100 (nível moderado). Há sinais estruturais.',
    recomendacoes: ['Confirme a mensagem pelo canal oficial antes de agir.'],
    evidenciasCitadas: ['palavra_isca'],
    ...sobrescrever,
  });
}

describe('validarRespostaIa', () => {
  it('aceita uma resposta no formato, com evidências que existem', () => {
    const resultado = validarRespostaIa(respostaValida(), CONTEXTO);

    expect(resultado.ok).toBe(true);
  });

  it('aceita o JSON dentro de uma cerca de código', () => {
    const resultado = validarRespostaIa('```json\n' + respostaValida() + '\n```', CONTEXTO);

    expect(resultado.ok).toBe(true);
  });

  it('recusa texto que não é JSON', () => {
    expect(validarRespostaIa('Aqui está a análise: ...', CONTEXTO)).toEqual({
      ok: false,
      motivo: 'formato',
    });
  });

  it('recusa campo extra fora do contrato', () => {
    const resultado = validarRespostaIa(respostaValida({ classificacao: 'seguro' }), CONTEXTO);

    expect(resultado).toEqual({ ok: false, motivo: 'contrato' });
  });

  it('recusa lista de recomendações vazia', () => {
    const resultado = validarRespostaIa(respostaValida({ recomendacoes: [] }), CONTEXTO);

    expect(resultado).toEqual({ ok: false, motivo: 'contrato' });
  });

  it('recusa resumo acima do limite de caracteres', () => {
    const resultado = validarRespostaIa(respostaValida({ resumo: 'x'.repeat(401) }), CONTEXTO);

    expect(resultado).toEqual({ ok: false, motivo: 'contrato' });
  });

  it('recusa evidência citada que o motor não produziu', () => {
    const resultado = validarRespostaIa(
      respostaValida({ evidenciasCitadas: ['evidencia_inventada'] }),
      CONTEXTO,
    );

    expect(resultado).toEqual({ ok: false, motivo: 'evidencia_desconhecida' });
  });

  it('recusa afirmação de segurança, que o produto nunca faz', () => {
    const resultado = validarRespostaIa(
      respostaValida({ resumo: 'Este endereço é seguro para acessar.' }),
      CONTEXTO,
    );

    expect(resultado).toEqual({ ok: false, motivo: 'contradicao' });
  });

  it('recusa afirmação de legitimidade quando o motor encontrou sinais', () => {
    const resultado = validarRespostaIa(
      respostaValida({ resumo: 'O endereço é legítimo e confiável.' }),
      CONTEXTO,
    );

    expect(resultado).toEqual({ ok: false, motivo: 'contradicao' });
  });

  it('aceita a negação de legitimidade quando nada foi encontrado', () => {
    const resultado = validarRespostaIa(
      respostaValida({
        resumo: 'Não encontramos sinais de risco.',
        justificativa: 'Pontuação 10 de 100 (nível baixo).',
        recomendacoes: ['A ausência de registro não confirma que o endereço é legítimo.'],
        evidenciasCitadas: [],
      }),
      { classificacao: 'nao_identificado', pontuacao: 10, evidencias: [] },
    );

    expect(resultado.ok).toBe(true);
  });

  it('recusa pontuação citada diferente da calculada pelo motor', () => {
    const resultado = validarRespostaIa(
      respostaValida({ justificativa: 'A pontuação é 90 de 100, portanto alta.' }),
      CONTEXTO,
    );

    expect(resultado).toEqual({ ok: false, motivo: 'contradicao' });
  });
});
