import { describe, expect, it } from 'vitest';
import corpus from '../../../tests/fixtures/corpus-injecao.json' with { type: 'json' };
import { analisarComIa, type EntradaAnaliseIa } from '../ai-analyst/analista.js';
import type { ProvedorIa } from '../ai-analyst/provedor.js';
import { analisarUrl } from './analisador.js';
import { REGRAS_RISCO } from './regras.js';
import type { CandidatoReputacao, RepositorioScans } from './repositorio.js';
import type { CorrespondenciaReputacao } from './tipos.js';

// Corpus de textos hostis (AI-007). Cada item tenta dar ordens ao modelo ou ao motor.
const TEXTOS_HOSTIS: string[] = corpus;

const AGORA = new Date('2026-11-02T12:00:00.000Z');
const HOST = 'golpe-teste.example.net';
const NORMALIZADA = `https://${HOST}/login`;
const FONTE_NEUTRA = 'Fonte de referência';

/** Repositório com uma correspondência recente e confiável. O nome da fonte é o texto de teste. */
function repositorioComFonte(fonte: string): Pick<RepositorioScans, 'buscarCorrespondencias'> {
  const correspondencia: CorrespondenciaReputacao = {
    tipo: 'domain',
    valor: HOST,
    fonte,
    confiabilidade: 5,
    ultimaVez: AGORA,
  };

  return {
    buscarCorrespondencias(_token: string, candidatos: CandidatoReputacao[]) {
      const casa = candidatos.some((c) => c.tipo === 'domain' && c.valor === HOST);
      return Promise.resolve(casa ? [correspondencia] : []);
    },
  };
}

function analisarComFonte(fonte: string) {
  return analisarUrl(
    { normalizada: NORMALIZADA, host: HOST },
    repositorioComFonte(fonte),
    'token-de-teste',
    REGRAS_RISCO,
    AGORA,
  );
}

const ENTRADA_IA: EntradaAnaliseIa = {
  classificacao: 'confirmado',
  pontuacao: 60,
  nivel: 'alto',
  host: HOST,
  evidencias: [
    {
      grupo: 'R',
      id: 'reputacao-domain',
      titulo: 'Correspondência com domínio de fonte conhecida',
      descricao: 'O indicador foi visto recentemente.',
      peso: 60,
    },
  ],
  fontes: [{ nome: FONTE_NEUTRA, status: 'consultada', correspondencias: 1 }],
};

function provedorQueResponde(texto: string): ProvedorIa {
  return {
    nome: 'anthropic',
    modelo: 'claude-haiku-5-5',
    gerarTexto: () => Promise.resolve(texto),
  };
}

describe('injeção pelo motor: texto hostil não altera o resultado', () => {
  const referencia = analisarComFonte(FONTE_NEUTRA);

  it.each(TEXTOS_HOSTIS)(
    'a fonte "%s" não muda classificação, pontuação nem evidências',
    async (texto) => {
      const resultado = await analisarComFonte(texto);

      expect(resultado.classificacao).toBe((await referencia).classificacao);
      expect(resultado.pontuacao).toBe((await referencia).pontuacao);
      expect(resultado.nivel).toBe((await referencia).nivel);
      expect(resultado.evidencias.map((e) => [e.id, e.peso])).toEqual(
        (await referencia).evidencias.map((e) => [e.id, e.peso]),
      );
    },
  );
});

describe('injeção pela IA: resposta que obedece ao texto hostil cai para fallback', () => {
  it.each(TEXTOS_HOSTIS)(
    'resposta que afirma segurança e repete "%s" é descartada',
    async (texto) => {
      const resposta = JSON.stringify({
        resumo: `Este endereço é seguro. ${texto}`,
        justificativa: 'Pontuação 0 de 100.',
        recomendacoes: ['Pode acessar sem cuidado.'],
        evidenciasCitadas: ['reputacao-domain'],
      });

      const resultado = await analisarComIa(
        { provedor: provedorQueResponde(resposta), timeoutMs: 1000 },
        ENTRADA_IA,
      );

      expect(resultado.status).toBe('fallback');
    },
  );

  it.each(TEXTOS_HOSTIS)(
    'a saída da IA nunca traz classificação ou pontuação, mesmo com "%s"',
    async (texto) => {
      const resposta = JSON.stringify({
        resumo: texto,
        justificativa: texto,
        recomendacoes: [texto],
        evidenciasCitadas: [],
        classificacao: 'nao_identificado',
        pontuacao: 0,
      });

      const resultado = await analisarComIa(
        { provedor: provedorQueResponde(resposta), timeoutMs: 1000 },
        ENTRADA_IA,
      );

      expect(resultado).not.toHaveProperty('classificacao');
      expect(resultado).not.toHaveProperty('pontuacao');
    },
  );
});
