import { afterEach, describe, expect, it, vi } from 'vitest';
import { buscarAmeaca, listarAmeacas } from './ameacas';

const AMEACA = {
  id: '44444444-4444-4444-8444-444444444444',
  titulo: 'CVE-2025-0001: Execução remota',
  descricao: 'Descrição.',
  categoria: 'exploited_vulnerability',
  severidade: 'alto',
  estadoVerificacao: 'nao_verificada',
  cveId: 'CVE-2025-0001',
  urlFonte: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
  fonte: { nome: 'CISA KEV' },
  publicadoEm: '2025-03-10T00:00:00.000Z',
  coletadoEm: '2026-11-01T03:00:00.000Z',
  ultimaVerificacao: null,
};

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('listarAmeacas', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('monta a consulta com filtros e envia o token', async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValue(respostaJson({ itens: [AMEACA], pagina: 0, limite: 20, temMais: false }));
    vi.stubGlobal('fetch', fetchFalso);

    const lista = await listarAmeacas('token-de-teste', {
      categoria: 'malware',
      severidade: 'critico',
      pagina: 0,
      limite: 20,
    });

    const [url, init] = fetchFalso.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/threats?');
    expect(url).toContain('categoria=malware');
    expect(url).toContain('severidade=critico');
    expect(url).toContain('limite=20');
    expect(init.headers).toEqual({ Authorization: 'Bearer token-de-teste' });
    expect(lista.itens[0]?.titulo).toBe(AMEACA.titulo);
  });

  it('não envia filtros que não foram escolhidos', async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValue(respostaJson({ itens: [], pagina: 0, limite: 20, temMais: false }));
    vi.stubGlobal('fetch', fetchFalso);

    await listarAmeacas('t', { pagina: 0, limite: 20 });

    const [url] = fetchFalso.mock.calls[0] as [string];
    expect(url).not.toContain('categoria');
    expect(url).not.toContain('severidade');
  });

  it('rejeita resposta que não respeita o contrato', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          respostaJson({ itens: [{ id: 'nao-uuid' }], pagina: 0, limite: 20, temMais: false }),
        ),
    );

    await expect(listarAmeacas('t', { pagina: 0, limite: 20 })).rejects.toThrow();
  });
});

describe('buscarAmeaca', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('devolve o detalhe com indicadores', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        respostaJson({
          ...AMEACA,
          indicadores: [
            {
              id: '55555555-5555-4555-8555-555555555555',
              tipo: 'cve',
              valor: 'CVE-2025-0001',
              confianca: 50,
              primeiraVez: '2026-11-01T03:00:00.000Z',
              ultimaVez: '2026-11-01T03:00:00.000Z',
            },
          ],
        }),
      ),
    );

    const detalhe = await buscarAmeaca('t', AMEACA.id);

    expect(detalhe.indicadores).toHaveLength(1);
    expect(detalhe.indicadores[0]?.valor).toBe('CVE-2025-0001');
  });
});
