import type { Session } from '@supabase/supabase-js';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from '@/router';
import { ErroApi } from '@/services/api';
import { listarAmeacas, type Ameaca } from '@/services/ameacas';
import { useSessaoStore } from '@/stores/sessao';
import AmeacasPage from './AmeacasPage.vue';

vi.mock('@/services/ameacas', () => ({
  listarAmeacas: vi.fn(),
}));

vi.mock('@/services/supabase', () => ({
  obterClienteSupabase: () => ({
    auth: {
      onAuthStateChange: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  }),
}));

const AMEACA_FALSA: Ameaca = {
  id: '44444444-4444-4444-8444-444444444444',
  titulo: 'CVE-2025-0001: Execução remota',
  descricao: null,
  categoria: 'exploited_vulnerability',
  severidade: 'critico',
  estadoVerificacao: 'nao_verificada',
  cveId: 'CVE-2025-0001',
  urlFonte: null,
  fonte: { nome: 'CISA KEV' },
  publicadoEm: '2025-03-10T00:00:00.000Z',
  coletadoEm: '2026-11-01T03:00:00.000Z',
  ultimaVerificacao: null,
};

function montar() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const sessao = useSessaoStore();
  sessao.sessao = { access_token: 'token-de-teste' } as unknown as Session;
  return mount(AmeacasPage, { global: { plugins: [pinia, router] } });
}

describe('AmeacasPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lista as ameaças recebidas da API', async () => {
    vi.mocked(listarAmeacas).mockResolvedValue({
      itens: [AMEACA_FALSA],
      pagina: 1,
      limite: 20,
      temMais: false,
    });

    const pagina = montar();
    await flushPromises();

    expect(pagina.text()).toContain('CVE-2025-0001: Execução remota');
    expect(pagina.text()).toContain('CISA KEV');
    expect(pagina.text()).toContain('Crítico');
  });

  it('mostra estado vazio sem filtros quando não há ameaças', async () => {
    vi.mocked(listarAmeacas).mockResolvedValue({
      itens: [],
      pagina: 1,
      limite: 20,
      temMais: false,
    });

    const pagina = montar();
    await flushPromises();

    expect(pagina.text()).toContain('Nenhuma ameaça coletada ainda');
  });

  it('mostra mensagem de sessão expirada quando a API recusa o token', async () => {
    vi.mocked(listarAmeacas).mockRejectedValue(new ErroApi(401));

    const pagina = montar();
    await flushPromises();

    expect(pagina.get('[role="alert"]').text()).toBe('Sua sessão expirou. Entre novamente.');
  });

  it('oferece carregar mais quando existe próxima página', async () => {
    vi.mocked(listarAmeacas).mockResolvedValue({
      itens: [AMEACA_FALSA],
      pagina: 1,
      limite: 20,
      temMais: true,
    });

    const pagina = montar();
    await flushPromises();

    expect(pagina.text()).toContain('Carregar mais');
  });
});
