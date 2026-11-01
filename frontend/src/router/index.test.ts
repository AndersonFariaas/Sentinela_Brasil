import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { router, destinoSeguro } from './index';

const auth = vi.hoisted(() => ({
  onAuthStateChange: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('@/services/supabase', () => ({
  obterClienteSupabase: () => ({ auth }),
}));

vi.mock('@/services/api', () => ({
  buscarPerfilAtual: vi.fn().mockResolvedValue({
    id: '11111111-1111-4111-8111-111111111111',
    email: 'ana@exemplo.com',
    fullName: null,
    role: 'user',
  }),
  verificarSaudeDaApi: vi.fn().mockResolvedValue(true),
}));

describe('destinoSeguro', () => {
  it('mantém caminhos internos', () => {
    expect(destinoSeguro('/historico')).toBe('/historico');
    expect(destinoSeguro('/ameacas/123?aba=detalhes')).toBe('/ameacas/123?aba=detalhes');
  });

  it.each([
    ['caminho externo com //', '//evil.example'],
    ['barra invertida depois da barra', '/\\evil.example'],
    ['endereço absoluto', 'https://evil.example'],
    ['valor não textual', 42],
    ['ausente', undefined],
  ])('troca %s por /', (_descricao, destino) => {
    expect(destinoSeguro(destino)).toBe('/');
  });
});

describe('guardas de rota', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('visitante é mandado para entrar, guardando o destino original', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await router.push('/historico');

    expect(router.currentRoute.value.name).toBe('entrar');
    expect(router.currentRoute.value.query.redirect).toBe('/historico');
  });

  it('usuário logado não volta para a tela de entrar', async () => {
    auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'token', user: { email: 'ana@exemplo.com' } } },
      error: null,
    });

    await router.push('/entrar');

    expect(router.currentRoute.value.name).toBe('painel');
  });

  it('título da aba acompanha a página', async () => {
    auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'token', user: { email: 'ana@exemplo.com' } } },
      error: null,
    });

    await router.push('/detector');

    expect(document.title).toBe('Detector de phishing · SENTINELA');
  });
});
