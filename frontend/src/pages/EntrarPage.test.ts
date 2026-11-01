import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from '@/router';
import { ErroAutenticacao, useSessaoStore } from '@/stores/sessao';
import EntrarPage from './EntrarPage.vue';

vi.mock('@/services/supabase', () => ({
  obterClienteSupabase: () => ({
    auth: {
      onAuthStateChange: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  }),
}));

vi.mock('@/services/api', () => ({
  buscarPerfilAtual: vi.fn(),
  verificarSaudeDaApi: vi.fn().mockResolvedValue(true),
}));

function montar() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return mount(EntrarPage, { global: { plugins: [pinia, router] } });
}

describe('EntrarPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mostra erro de formato sem chamar o Auth', async () => {
    const pagina = montar();
    const sessao = useSessaoStore();
    const entrar = vi.spyOn(sessao, 'entrar');

    await pagina.get('form').trigger('submit');
    await flushPromises();

    expect(pagina.text()).toContain('Informe um e-mail válido.');
    expect(entrar).not.toHaveBeenCalled();
  });

  it('mostra a mensagem de credenciais inválidas vinda da store', async () => {
    const pagina = montar();
    const sessao = useSessaoStore();
    vi.spyOn(sessao, 'entrar').mockRejectedValue(
      new ErroAutenticacao('E-mail ou senha inválidos.'),
    );

    await pagina.get('#email').setValue('ana@exemplo.com');
    await pagina.get('#senha').setValue('senha-errada');
    await pagina.get('form').trigger('submit');
    await flushPromises();

    expect(pagina.get('[role="alert"]').text()).toBe('E-mail ou senha inválidos.');
  });

  it('desabilita o botão enquanto envia', async () => {
    const pagina = montar();
    const sessao = useSessaoStore();
    vi.spyOn(sessao, 'entrar').mockReturnValue(new Promise(() => undefined));

    await pagina.get('#email').setValue('ana@exemplo.com');
    await pagina.get('#senha').setValue('senha-de-teste');
    await pagina.get('form').trigger('submit');
    await flushPromises();

    expect(pagina.get('button[type="submit"]').attributes('disabled')).toBeDefined();
  });
});
