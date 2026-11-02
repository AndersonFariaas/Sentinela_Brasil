import { describe, expect, it, vi } from 'vitest';
import { analisarUrl, gerarCandidatos } from './analisador.js';
import { REGRAS_RISCO } from './regras.js';
import type { RepositorioScans } from './repositorio.js';
import type { CorrespondenciaReputacao } from './tipos.js';

const AGORA = new Date('2026-11-01T12:00:00.000Z');

function repositorioCom(correspondencias: CorrespondenciaReputacao[]) {
  return {
    buscarCorrespondencias: vi.fn().mockResolvedValue(correspondencias),
  } satisfies Pick<RepositorioScans, 'buscarCorrespondencias'>;
}

describe('gerarCandidatos', () => {
  it('inclui a URL, o host e os domínios pais', () => {
    expect(gerarCandidatos('login.banco.exemplo.com', 'https://login.banco.exemplo.com/')).toEqual([
      { tipo: 'url', valor: 'https://login.banco.exemplo.com/' },
      { tipo: 'domain', valor: 'login.banco.exemplo.com' },
      { tipo: 'domain', valor: 'banco.exemplo.com' },
      { tipo: 'domain', valor: 'exemplo.com' },
    ]);
  });

  it('não consulta o TLD sozinho', () => {
    const dominios = gerarCandidatos('exemplo.com', 'https://exemplo.com/')
      .filter((candidato) => candidato.tipo === 'domain')
      .map((candidato) => candidato.valor);

    expect(dominios).toEqual(['exemplo.com']);
  });

  it('usa IP como indicador do tipo ip quando o host é um endereço', () => {
    expect(gerarCandidatos('8.8.8.8', 'https://8.8.8.8/')).toContainEqual({
      tipo: 'ip',
      valor: '8.8.8.8',
    });
  });
});

describe('analisarUrl', () => {
  it('sem correspondências, não confirma e explica que a ausência não prova legitimidade', async () => {
    const resultado = await analisarUrl(
      { normalizada: 'https://www.exemplo.com.br/noticias', host: 'www.exemplo.com.br' },
      repositorioCom([]),
      'token',
      REGRAS_RISCO,
      AGORA,
    );

    expect(resultado.classificacao).toBe('nao_identificado');
    expect(resultado.fontes).toEqual([
      { nome: 'Indicadores coletados', status: 'consultada', correspondencias: 0 },
    ]);
    expect(resultado.explicacao.recomendacoes.join(' ')).toContain('não confirma');
  });

  it('com correspondência recente de fonte confiável, confirma e lista a fonte', async () => {
    const correspondencia: CorrespondenciaReputacao = {
      tipo: 'domain',
      valor: 'golpe.example',
      fonte: 'Fonte de teste',
      confiabilidade: 5,
      ultimaVez: AGORA,
    };

    const resultado = await analisarUrl(
      { normalizada: 'https://pagina.golpe.example/', host: 'pagina.golpe.example' },
      repositorioCom([correspondencia]),
      'token',
      REGRAS_RISCO,
      AGORA,
    );

    expect(resultado.classificacao).toBe('confirmado');
    expect(resultado.fontes).toEqual([
      { nome: 'Fonte de teste', status: 'consultada', correspondencias: 1 },
    ]);
    expect(resultado.evidencias[0]?.grupo).toBe('R');
  });

  it('passa o token do usuário à consulta de reputação', async () => {
    const repositorio = repositorioCom([]);

    await analisarUrl(
      { normalizada: 'https://exemplo.com/', host: 'exemplo.com' },
      repositorio,
      'token-do-usuario',
      REGRAS_RISCO,
      AGORA,
    );

    expect(repositorio.buscarCorrespondencias).toHaveBeenCalledWith(
      'token-do-usuario',
      expect.arrayContaining([{ tipo: 'domain', valor: 'exemplo.com' }]),
    );
  });
});
