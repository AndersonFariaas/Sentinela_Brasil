import { describe, expect, it, vi } from 'vitest';
import { ErroColeta } from '../../modules/intelligence/erros.js';
import { buscarTextoSeguro, type OpcoesBusca } from './cliente-seguro.js';

const OPCOES: OpcoesBusca = {
  timeoutMs: 1000,
  tamanhoMaximoBytes: 100,
  hostsPermitidos: ['www.cisa.gov'],
};

describe('buscarTextoSeguro', () => {
  it('recusa host fora da lista sem fazer nenhuma requisição', async () => {
    const fetchFalso = vi.fn();

    await expect(
      buscarTextoSeguro('https://interno.exemplo/recurso', OPCOES, fetchFalso),
    ).rejects.toThrow('Host não permitido');
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('recusa HTTP sem TLS', async () => {
    await expect(buscarTextoSeguro('http://www.cisa.gov/feed', OPCOES, vi.fn())).rejects.toThrow(
      'HTTPS',
    );
  });

  it('desativa redirecionamentos para impedir saltos a destinos internos', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));

    await buscarTextoSeguro('https://www.cisa.gov/feed', OPCOES, fetchFalso);

    expect(fetchFalso).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ redirect: 'error' }),
    );
  });

  it('devolve o texto quando a resposta é válida', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response('conteúdo', { status: 200 }));

    await expect(buscarTextoSeguro('https://www.cisa.gov/feed', OPCOES, fetchFalso)).resolves.toBe(
      'conteúdo',
    );
  });

  it('recusa resposta de erro HTTP sem expor o corpo', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response('segredo-interno', { status: 503 }));

    const erro = await buscarTextoSeguro('https://www.cisa.gov/feed', OPCOES, fetchFalso).catch(
      (e: unknown) => e,
    );

    expect(erro).toBeInstanceOf(ErroColeta);
    expect((erro as Error).message).toBe('A fonte respondeu com HTTP 503.');
    expect((erro as Error).message).not.toContain('segredo-interno');
  });

  it('recusa resposta acima do tamanho máximo', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(new Response('x'.repeat(500), { status: 200 }));

    await expect(
      buscarTextoSeguro('https://www.cisa.gov/feed', OPCOES, fetchFalso),
    ).rejects.toThrow('tamanho máximo');
  });
});
