import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErroApi } from './api';
import {
  buscarAnalise,
  criarAnalise,
  ErroUrlRecusada,
  excluirAnalise,
  listarHistorico,
} from './scans';

const ID = '66666666-6666-4666-8666-666666666666';

const SCAN = {
  id: ID,
  url: 'https://exemplo.com/login',
  host: 'exemplo.com',
  classificacao: 'suspeito',
  pontuacao: 40,
  nivel: 'alto',
  criadaEm: '2026-11-01T12:00:00.000Z',
  evidencias: [
    {
      grupo: 'E',
      id: 'ip_no_host',
      titulo: 'Endereço IP no lugar do nome',
      descricao: 'Descrição de teste.',
      peso: 40,
    },
  ],
  fontes: [{ nome: 'Indicadores coletados', status: 'consultada', correspondencias: 0 }],
  analise: {
    status: 'fallback',
    modelo: null,
    evidenciasCitadas: [],
    resumo: 'Resumo de teste.',
    justificativa: 'Justificativa de teste.',
    recomendacoes: ['Recomendação de teste.'],
  },
  algoritmo: '1.0.0',
};

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('criarAnalise', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envia a URL com o token e devolve o resultado validado', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(respostaJson(SCAN, 201));
    vi.stubGlobal('fetch', fetchFalso);

    const resultado = await criarAnalise('token-de-teste', 'https://exemplo.com/login');

    const [url, init] = fetchFalso.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/scans');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ url: 'https://exemplo.com/login' }));
    expect(resultado.id).toBe(ID);
    expect(resultado.classificacao).toBe('suspeito');
  });

  it('transforma a recusa da URL em ErroUrlRecusada com a mensagem do servidor', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        respostaJson(
          {
            error: {
              code: 'URL_INVALIDA',
              message: 'Endereços internos ou privados não são analisados.',
            },
          },
          400,
        ),
      ),
    );

    const falha = await criarAnalise('t', 'http://127.0.0.1/').catch((erro: unknown) => erro);

    expect(falha).toBeInstanceOf(ErroUrlRecusada);
    expect((falha as ErroUrlRecusada).mensagem).toBe(
      'Endereços internos ou privados não são analisados.',
    );
  });

  it('propaga ErroApi quando o token é recusado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson({}, 401)));

    await expect(criarAnalise('t', 'https://exemplo.com/')).rejects.toBeInstanceOf(ErroApi);
  });

  it('rejeita resposta que não respeita o contrato', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respostaJson({ ...SCAN, classificacao: 'seguro' }, 201)),
    );

    await expect(criarAnalise('t', 'https://exemplo.com/')).rejects.toThrow();
  });
});

describe('buscarAnalise', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('busca o resultado pelo id', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(respostaJson(SCAN));
    vi.stubGlobal('fetch', fetchFalso);

    const resultado = await buscarAnalise('t', ID);

    const [url] = fetchFalso.mock.calls[0] as [string];
    expect(url).toContain(`/api/v1/scans/${ID}`);
    expect(resultado.analise.resumo).toBe('Resumo de teste.');
  });

  it('lança ErroApi 404 quando o resultado não existe', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson({}, 404)));

    const falha = await buscarAnalise('t', ID).catch((erro: unknown) => erro);

    expect(falha).toBeInstanceOf(ErroApi);
    expect((falha as ErroApi).status).toBe(404);
  });
});

const RESUMO = {
  id: ID,
  url: 'https://exemplo.com/login',
  host: 'exemplo.com',
  classificacao: 'suspeito',
  pontuacao: 40,
  nivel: 'alto',
  criadaEm: '2026-11-01T12:00:00.000Z',
};

describe('listarHistorico', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pede a página e o limite na URL e devolve o histórico validado', async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValue(respostaJson({ itens: [RESUMO], pagina: 2, limite: 20, temMais: true }));
    vi.stubGlobal('fetch', fetchFalso);

    const historico = await listarHistorico('token', 2, 20);

    const [url] = fetchFalso.mock.calls[0] as [string];
    expect(url).toContain('/api/v1/scans?pagina=2&limite=20');
    expect(historico.itens).toHaveLength(1);
    expect(historico.temMais).toBe(true);
  });

  it('rejeita item do histórico fora do contrato', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        respostaJson({
          itens: [{ ...RESUMO, classificacao: 'seguro' }],
          pagina: 1,
          limite: 20,
          temMais: false,
        }),
      ),
    );

    await expect(listarHistorico('token', 1, 20)).rejects.toThrow();
  });
});

describe('excluirAnalise', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envia DELETE e aceita a resposta 204 sem corpo', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchFalso);

    await excluirAnalise('token', ID);

    const [url, init] = fetchFalso.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/api/v1/scans/${ID}`);
    expect(init.method).toBe('DELETE');
  });

  it('propaga ErroApi 404 quando o registro já não existe', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson({}, 404)));

    const falha = await excluirAnalise('token', ID).catch((erro: unknown) => erro);

    expect(falha).toBeInstanceOf(ErroApi);
    expect((falha as ErroApi).status).toBe(404);
  });
});
