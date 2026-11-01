import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { verificarSaudeDaApi } from '@/services/api';
import PainelPage from './PainelPage.vue';

vi.mock('@/services/api', () => ({
  verificarSaudeDaApi: vi.fn(),
}));

describe('PainelPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mostra a API como online quando a verificação passa', async () => {
    vi.mocked(verificarSaudeDaApi).mockResolvedValue(true);

    const pagina = mount(PainelPage);
    await flushPromises();

    expect(pagina.text()).toContain('online');
  });

  it('mostra a API como indisponível quando a verificação falha', async () => {
    vi.mocked(verificarSaudeDaApi).mockResolvedValue(false);

    const pagina = mount(PainelPage);
    await flushPromises();

    expect(pagina.text()).toContain('indisponível');
  });

  it('exibe estado vazio enquanto não há indicadores', async () => {
    vi.mocked(verificarSaudeDaApi).mockResolvedValue(true);

    const pagina = mount(PainelPage);
    await flushPromises();

    expect(pagina.text()).toContain('Nenhum indicador ainda');
  });
});
