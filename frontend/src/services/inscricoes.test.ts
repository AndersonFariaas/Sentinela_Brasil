import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErroApi } from './api';
import { definirInscricao, listarInscricoes } from './inscricoes';

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('listarInscricoes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('devolve as inscrições validadas', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(
      respostaJson({
        inscricoes: [
          { categoria: 'phishing', ativa: true },
          { categoria: 'malware', ativa: false },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchFalso);

    const inscricoes = await listarInscricoes('token');

    const [url] = fetchFalso.mock.calls[0] as [string];
    expect(url).toContain('/api/v1/alertas/inscricoes');
    expect(inscricoes).toEqual([
      { categoria: 'phishing', ativa: true },
      { categoria: 'malware', ativa: false },
    ]);
  });

  it('rejeita resposta com categoria fora do contrato', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(respostaJson({ inscricoes: [{ categoria: 'inventada', ativa: true }] })),
    );

    await expect(listarInscricoes('token')).rejects.toThrow();
  });
});

describe('definirInscricao', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envia PUT com o estado e devolve o que o servidor gravou', async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValue(respostaJson({ categoria: 'phishing', ativa: true }));
    vi.stubGlobal('fetch', fetchFalso);

    const gravada = await definirInscricao('token', 'phishing', true);

    const [url, init] = fetchFalso.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/alertas/inscricoes/phishing');
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(JSON.stringify({ ativa: true }));
    expect(gravada).toEqual({ categoria: 'phishing', ativa: true });
  });

  it('propaga ErroApi com o detalhe do servidor quando a categoria é recusada', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          respostaJson({ error: { code: 'DADOS_INVALIDOS', message: 'Categoria inválida.' } }, 400),
        ),
    );

    const falha = await definirInscricao('token', 'phishing', true).catch((erro: unknown) => erro);

    expect(falha).toBeInstanceOf(ErroApi);
    expect((falha as ErroApi).status).toBe(400);
  });
});
