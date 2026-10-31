import { afterEach, describe, expect, it, vi } from 'vitest';
import { verificarSaudeDaApi } from './api';

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
