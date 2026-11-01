import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErroApi, buscarPerfilAtual, verificarSaudeDaApi } from './api';

const PERFIL_VALIDO = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'ana@exemplo.com',
  fullName: null,
  role: 'user',
};

describe('verificarSaudeDaApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('retorna true quando a API responde status ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), { status: 200 })),
    );

    expect(await verificarSaudeDaApi()).toBe(true);
  });

  it('retorna false quando o corpo está fora do contrato', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'erro' }), { status: 200 })),
    );

    expect(await verificarSaudeDaApi()).toBe(false);
  });

  it('retorna false quando o status HTTP não é de sucesso', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    expect(await verificarSaudeDaApi()).toBe(false);
  });

  it('retorna false e registra o erro quando a rede falha', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    expect(await verificarSaudeDaApi()).toBe(false);
    expect(console.error).toHaveBeenCalledOnce();
  });
});

describe('buscarPerfilAtual', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('envia o token no cabeçalho e devolve o perfil validado', async () => {
    const fetchFalso = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(PERFIL_VALIDO), { status: 200 }));
    vi.stubGlobal('fetch', fetchFalso);

    const perfil = await buscarPerfilAtual('token-de-teste');

    expect(perfil).toEqual(PERFIL_VALIDO);
    expect(fetchFalso).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/me'),
      expect.objectContaining({ headers: { Authorization: 'Bearer token-de-teste' } }),
    );
  });

  it('lança ErroApi com o status quando o token é recusado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));

    const erro = await buscarPerfilAtual('token-invalido').catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroApi);
    expect((erro as ErroApi).status).toBe(401);
  });

  it('rejeita resposta que não respeita o contrato do perfil', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ ...PERFIL_VALIDO, role: 'superusuario' }), { status: 200 }),
        ),
    );

    await expect(buscarPerfilAtual('token')).rejects.toThrow();
  });
});
