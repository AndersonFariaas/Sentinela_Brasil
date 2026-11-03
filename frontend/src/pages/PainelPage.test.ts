import type { Session } from '@supabase/supabase-js';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { verificarSaudeDaApi } from '@/services/api';
import { listarAmeacas, type Ameaca } from '@/services/ameacas';
import { useSessaoStore } from '@/stores/sessao';
import PainelPage from './PainelPage.vue';

vi.mock('@/services/api', () => ({
  verificarSaudeDaApi: vi.fn(),
}));

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

const AMEACA_VERIFICADA: Ameaca = {
  id: '55555555-5555-4555-8555-555555555555',
  titulo: 'CVE-2025-0002: Escalonamento de privilégio',
  descricao: null,
  categoria: 'exploited_vulnerability',
  severidade: 'alto',
  estadoVerificacao: 'verificada',
  cveId: 'CVE-2025-0002',
  urlFonte: null,
  fonte: { nome: 'CISA KEV' },
  publicadoEm: '2025-04-01T00:00:00.000Z',
  coletadoEm: '2026-11-01T03:00:00.000Z',
  ultimaVerificacao: null,
};

function montar() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const sessao = useSessaoStore();
  sessao.sessao = { access_token: 'token-de-teste' } as unknown as Session;
  return mount(PainelPage, {
    global: { plugins: [pinia], stubs: { RouterLink: RouterLinkStub } },
  });
}

describe('PainelPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listarAmeacas).mockResolvedValue({
      itens: [],
      pagina: 1,
      limite: 3,
      temMais: false,
    });
  });

  it('mostra a API como online quando a verificação passa', async () => {
    vi.mocked(verificarSaudeDaApi).mockResolvedValue(true);

    const pagina = montar();
    await flushPromises();

    expect(pagina.text()).toContain('online');
  });

  it('mostra a API como indisponível quando a verificação falha', async () => {
    vi.mocked(verificarSaudeDaApi).mockResolvedValue(false);

    const pagina = montar();
    await flushPromises();

    expect(pagina.text()).toContain('indisponível');
  });

  it('pede só as três ameaças mais recentes', async () => {
    vi.mocked(verificarSaudeDaApi).mockResolvedValue(true);

    montar();
    await flushPromises();

    expect(listarAmeacas).toHaveBeenCalledWith('token-de-teste', { pagina: 1, limite: 3 });
  });

  it('exibe estado vazio quando ainda não há ameaças coletadas', async () => {
    vi.mocked(verificarSaudeDaApi).mockResolvedValue(true);

    const pagina = montar();
    await flushPromises();

    expect(pagina.text()).toContain('Nenhuma ameaça coletada ainda');
  });

  it('mostra as ameaças recentes com a marca de confirmação da fonte', async () => {
    vi.mocked(verificarSaudeDaApi).mockResolvedValue(true);
    vi.mocked(listarAmeacas).mockResolvedValue({
      itens: [AMEACA_VERIFICADA],
      pagina: 1,
      limite: 3,
      temMais: false,
    });

    const pagina = montar();
    await flushPromises();

    expect(pagina.text()).toContain('CVE-2025-0002: Escalonamento de privilégio');
    expect(pagina.text()).toContain('Confirmada pela fonte');
  });
});
