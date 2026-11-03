import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { router } from '@/router';
import CadastroPage from './CadastroPage.vue';

const signUp = vi.hoisted(() => vi.fn());

vi.mock('@/services/supabase', () => ({
  obterClienteSupabase: () => ({
    auth: {
      onAuthStateChange: vi.fn(),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signUp,
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
  return mount(CadastroPage, { global: { plugins: [pinia, router] } });
}

describe('CadastroPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('depois de criar a conta, avisa que é preciso confirmar o e-mail antes de entrar', async () => {
    signUp.mockResolvedValue({ data: { session: null, user: null }, error: null });
    const pagina = montar();

    await pagina.get('#email').setValue('ana@exemplo.com');
    await pagina.get('#senha').setValue('senha-de-teste');
    await pagina.get('#confirmarSenha').setValue('senha-de-teste');
    await pagina.get('form').trigger('submit');
    await flushPromises();

    const aviso = pagina.get('[role="status"]').text();
    expect(aviso).toContain('Confirme seu e-mail antes de entrar');
    expect(aviso).toContain('ana@exemplo.com');
    expect(aviso).toContain('Clique no link de confirmação');
    expect(aviso).toContain('Sem a confirmação, o login não funciona');
  });
});
