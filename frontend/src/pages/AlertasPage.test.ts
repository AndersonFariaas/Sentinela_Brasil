import type { Session } from '@supabase/supabase-js';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { definirInscricao, listarInscricoes } from '@/services/inscricoes';
import { useSessaoStore } from '@/stores/sessao';
import AlertasPage from './AlertasPage.vue';

vi.mock('@/services/inscricoes', () => ({
  listarInscricoes: vi.fn(),
  definirInscricao: vi.fn(),
}));

const INSCRICOES = [
  { categoria: 'phishing' as const, ativa: false },
  { categoria: 'malware' as const, ativa: true },
];

function montar() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const sessao = useSessaoStore();
  sessao.sessao = { access_token: 'token-de-teste' } as Session;

  return mount(AlertasPage, { global: { plugins: [pinia] } });
}

function interruptores(pagina: ReturnType<typeof montar>) {
  return pagina.findAll('[role="switch"]');
}

describe('AlertasPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listarInscricoes).mockResolvedValue(INSCRICOES);
  });

  it('mostra cada categoria com o estado da inscrição', async () => {
    const pagina = montar();
    await flushPromises();

    const [phishing, malware] = interruptores(pagina);
    expect(phishing.attributes('aria-checked')).toBe('false');
    expect(malware.attributes('aria-checked')).toBe('true');
  });

  it('alterna a inscrição, mostra o novo estado e grava no servidor', async () => {
    vi.mocked(definirInscricao).mockResolvedValue({ categoria: 'phishing', ativa: true });

    const pagina = montar();
    await flushPromises();

    await interruptores(pagina)[0]?.trigger('click');
    await flushPromises();

    expect(definirInscricao).toHaveBeenCalledWith('token-de-teste', 'phishing', true);
    expect(interruptores(pagina)[0]?.attributes('aria-checked')).toBe('true');
  });

  it('se o servidor recusar, volta ao estado anterior e mostra o erro', async () => {
    vi.mocked(definirInscricao).mockRejectedValue(new Error('falha de rede'));

    const pagina = montar();
    await flushPromises();

    await interruptores(pagina)[0]?.trigger('click');
    await flushPromises();

    expect(interruptores(pagina)[0]?.attributes('aria-checked')).toBe('false');
    expect(pagina.text()).toContain('Não foi possível salvar a alteração');
  });

  it('erro ao carregar oferece tentar de novo', async () => {
    vi.mocked(listarInscricoes).mockRejectedValueOnce(new Error('falha'));

    const pagina = montar();
    await flushPromises();

    expect(pagina.text()).toContain('Não foi possível salvar a alteração');
    expect(pagina.findAll('button').some((b) => b.text() === 'Tentar de novo')).toBe(true);
  });
});
