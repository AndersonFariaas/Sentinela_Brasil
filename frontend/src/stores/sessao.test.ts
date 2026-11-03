import type { Session } from '@supabase/supabase-js';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buscarPerfilAtual, type PerfilUsuario } from '@/services/api';
import { ErroAutenticacao, useSessaoStore } from './sessao';

const auth = vi.hoisted(() => ({
  onAuthStateChange: vi.fn(),
  getSession: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/services/supabase', () => ({
  obterClienteSupabase: () => ({ auth }),
}));

vi.mock('@/services/api', () => ({
  buscarPerfilAtual: vi.fn(),
}));

const sessaoFalsa = {
  access_token: 'token-de-teste',
  user: { email: 'ana@exemplo.com' },
} as unknown as Session;

const perfilFalso: PerfilUsuario = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'ana@exemplo.com',
  fullName: null,
  role: 'user',
};

describe('useSessaoStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    vi.mocked(buscarPerfilAtual).mockResolvedValue(perfilFalso);
  });

  it('entrar guarda a sessão e carrega o perfil', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { session: sessaoFalsa }, error: null });
    const sessao = useSessaoStore();

    await sessao.entrar('ana@exemplo.com', 'senha-de-teste');

    expect(sessao.autenticado).toBe(true);
    expect(sessao.perfil).toEqual(perfilFalso);
    expect(buscarPerfilAtual).toHaveBeenCalledWith('token-de-teste');
  });

  it('entrar com credenciais inválidas mostra mensagem genérica', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    });
    const sessao = useSessaoStore();

    const erro = await sessao.entrar('ana@exemplo.com', 'errada').catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroAutenticacao);
    expect((erro as Error).message).toBe('E-mail ou senha inválidos.');
    expect(sessao.autenticado).toBe(false);
  });

  it('entrar com e-mail ainda não confirmado orienta a confirmar o cadastro', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { code: 'email_not_confirmed', message: 'Email not confirmed' },
    });
    const sessao = useSessaoStore();

    const erro = await sessao.entrar('ana@exemplo.com', 'senha-de-teste').catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroAutenticacao);
    expect((erro as Error).message).toBe(
      'Confirme seu e-mail antes de entrar. Procure o link na caixa de entrada e no spam.',
    );
    expect(sessao.autenticado).toBe(false);
  });

  it('entrar com falha que não é de credencial não expõe o detalhe técnico', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { code: 'unexpected_failure', message: 'Database error querying schema' },
    });
    const sessao = useSessaoStore();

    const erro = await sessao.entrar('ana@exemplo.com', 'x').catch((e: unknown) => e);

    expect((erro as Error).message).not.toContain('Database');
    expect((erro as Error).message).toBe(
      'Não foi possível concluir agora. Tente novamente em instantes.',
    );
  });

  it('cadastrar sem sessão pede confirmação de e-mail', async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const sessao = useSessaoStore();

    const resultado = await sessao.cadastrar('ana@exemplo.com', 'senha-forte-1');

    expect(resultado).toBe('confirmar-email');
    expect(sessao.autenticado).toBe(false);
  });

  it('cadastrar com limite de envio de e-mail explica a espera, sem expor o detalhe', async () => {
    auth.signUp.mockResolvedValue({
      data: { session: null },
      error: { code: 'over_email_send_rate_limit', message: '429: email rate limit exceeded' },
    });
    const sessao = useSessaoStore();

    const erro = await sessao
      .cadastrar('ana@exemplo.com', 'senha-forte-1')
      .catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroAutenticacao);
    expect((erro as Error).message).toBe(
      'Muitas tentativas de cadastro em pouco tempo. Aguarde cerca de uma hora e tente de novo.',
    );
    expect((erro as Error).message).not.toContain('rate limit');
  });

  it('sair limpa a sessão e o perfil', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { session: sessaoFalsa }, error: null });
    auth.signOut.mockResolvedValue({ error: null });
    const sessao = useSessaoStore();
    await sessao.entrar('ana@exemplo.com', 'senha-de-teste');

    await sessao.sair();

    expect(sessao.autenticado).toBe(false);
    expect(sessao.perfil).toBeNull();
  });

  it('iniciar restaura a sessão salva e assina as mudanças só uma vez', async () => {
    auth.getSession.mockResolvedValue({ data: { session: sessaoFalsa }, error: null });
    const sessao = useSessaoStore();

    await sessao.iniciar();
    await sessao.iniciar();

    expect(sessao.autenticado).toBe(true);
    expect(auth.onAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it('mantém a sessão mesmo se o perfil não puder ser carregado', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(buscarPerfilAtual).mockRejectedValue(new Error('API fora do ar'));
    auth.signInWithPassword.mockResolvedValue({ data: { session: sessaoFalsa }, error: null });
    const sessao = useSessaoStore();

    await sessao.entrar('ana@exemplo.com', 'senha-de-teste');

    expect(sessao.autenticado).toBe(true);
    expect(sessao.perfil).toBeNull();
    vi.restoreAllMocks();
  });
});
