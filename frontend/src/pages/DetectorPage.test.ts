import type { Session } from '@supabase/supabase-js';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroApi } from '@/services/api';
import { criarAnalise, ErroUrlRecusada } from '@/services/scans';
import { useSessaoStore } from '@/stores/sessao';
import DetectorPage from './DetectorPage.vue';

const navegar = vi.fn();

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: navegar }),
}));

vi.mock('@/services/scans', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/scans')>();
  return { ...original, criarAnalise: vi.fn() };
});

function montar() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const sessao = useSessaoStore();
  sessao.sessao = { access_token: 'token-de-teste' } as Session;

  return mount(DetectorPage, { global: { plugins: [pinia] } });
}

describe('DetectorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mostra erro no campo para URL sem http ou https e não envia nada', async () => {
    const pagina = montar();

    await pagina.get('#url').setValue('exemplo.com');
    await pagina.get('form').trigger('submit');
    await flushPromises();

    expect(pagina.get('#erro-url').text()).toContain('http://');
    expect(criarAnalise).not.toHaveBeenCalled();
  });

  it('envia a URL e segue para a tela do resultado', async () => {
    vi.mocked(criarAnalise).mockResolvedValue({ id: 'abc-123' } as Awaited<
      ReturnType<typeof criarAnalise>
    >);
    const pagina = montar();

    await pagina.get('#url').setValue('  https://exemplo.com/login  ');
    await pagina.get('form').trigger('submit');
    await flushPromises();

    expect(criarAnalise).toHaveBeenCalledWith('token-de-teste', 'https://exemplo.com/login');
    expect(navegar).toHaveBeenCalledWith({ name: 'resultado', params: { id: 'abc-123' } });
  });

  it('mostra no campo a mensagem de recusa do servidor', async () => {
    vi.mocked(criarAnalise).mockRejectedValue(
      new ErroUrlRecusada('Endereços internos ou privados não são analisados.'),
    );
    const pagina = montar();

    await pagina.get('#url').setValue('https://exemplo.com/');
    await pagina.get('form').trigger('submit');
    await flushPromises();

    expect(pagina.get('#erro-url').text()).toBe(
      'Endereços internos ou privados não são analisados.',
    );
    expect(navegar).not.toHaveBeenCalled();
  });

  it('pede novo login quando o token é recusado', async () => {
    vi.mocked(criarAnalise).mockRejectedValue(new ErroApi(401));
    const pagina = montar();

    await pagina.get('#url').setValue('https://exemplo.com/');
    await pagina.get('form').trigger('submit');
    await flushPromises();

    expect(pagina.get('[role="alert"]').text()).toBe('Sua sessão expirou. Entre novamente.');
  });
});
