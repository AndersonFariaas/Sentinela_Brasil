import type { Session } from '@supabase/supabase-js';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { buscarPerfilAtual, type PerfilUsuario } from '@/services/api';
import { obterClienteSupabase } from '@/services/supabase';

/** Erro de autenticação com mensagem já pronta para o usuário. */
export class ErroAutenticacao extends Error {}

export type ResultadoCadastro = 'conta-criada' | 'confirmar-email';

const MENSAGEM_CREDENCIAIS = 'E-mail ou senha inválidos.';
const MENSAGEM_INDISPONIVEL = 'Não foi possível concluir agora. Tente novamente em instantes.';
const MENSAGEM_CADASTRO =
  'Não foi possível concluir o cadastro. Verifique os dados e tente novamente.';
const MENSAGEM_EMAIL_NAO_CONFIRMADO =
  'Confirme seu e-mail antes de entrar. Procure o link na caixa de entrada e no spam.';
const CODIGO_CREDENCIAIS_INVALIDAS = 'invalid_credentials';
const CODIGO_EMAIL_NAO_CONFIRMADO = 'email_not_confirmed';

/** Traduz o código do Supabase. Só falhas conhecidas ganham mensagem própria. */
function mensagemDeErroDeLogin(codigo: string | undefined): string {
  if (codigo === CODIGO_CREDENCIAIS_INVALIDAS) {
    return MENSAGEM_CREDENCIAIS;
  }
  if (codigo === CODIGO_EMAIL_NAO_CONFIRMADO) {
    return MENSAGEM_EMAIL_NAO_CONFIRMADO;
  }
  return MENSAGEM_INDISPONIVEL;
}

export const useSessaoStore = defineStore('sessao', () => {
  const sessao = ref<Session | null>(null);
  const perfil = ref<PerfilUsuario | null>(null);
  let inicializacao: Promise<void> | undefined;

  const autenticado = computed(() => sessao.value !== null);
  const ehAdmin = computed(() => perfil.value?.role === 'admin');

  async function aplicarSessao(novaSessao: Session | null): Promise<void> {
    sessao.value = novaSessao;
    perfil.value = null;

    if (!novaSessao) {
      return;
    }

    try {
      const perfilCarregado = await buscarPerfilAtual(novaSessao.access_token);
      // Ignora a resposta se, enquanto ela chegava, o usuário já saiu ou trocou de sessão.
      if (sessao.value?.access_token === novaSessao.access_token) {
        perfil.value = perfilCarregado;
      }
    } catch (error) {
      console.error('Falha ao carregar o perfil do usuário', error);
    }
  }

  /** Lê a sessão salva e acompanha mudanças. Chamada uma vez, na primeira navegação. */
  function iniciar(): Promise<void> {
    inicializacao ??= carregarSessaoInicial();
    return inicializacao;
  }

  async function carregarSessaoInicial(): Promise<void> {
    const auth = obterClienteSupabase().auth;

    auth.onAuthStateChange((_evento, novaSessao) => {
      void aplicarSessao(novaSessao);
    });

    const { data } = await auth.getSession();
    await aplicarSessao(data.session);
  }

  async function entrar(email: string, senha: string): Promise<void> {
    const { data, error } = await obterClienteSupabase().auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      throw new ErroAutenticacao(mensagemDeErroDeLogin(error.code));
    }

    await aplicarSessao(data.session);
  }

  async function cadastrar(email: string, senha: string): Promise<ResultadoCadastro> {
    const { data, error } = await obterClienteSupabase().auth.signUp({
      email,
      password: senha,
    });

    if (error) {
      throw new ErroAutenticacao(MENSAGEM_CADASTRO);
    }

    // Com confirmação de e-mail ativa, o Supabase não devolve sessão até o link ser aberto.
    if (!data.session) {
      return 'confirmar-email';
    }

    await aplicarSessao(data.session);
    return 'conta-criada';
  }

  async function sair(): Promise<void> {
    const { error } = await obterClienteSupabase().auth.signOut();

    if (error) {
      throw new ErroAutenticacao('Não foi possível sair agora. Tente novamente.');
    }

    await aplicarSessao(null);
  }

  return {
    sessao,
    perfil,
    autenticado,
    ehAdmin,
    iniciar,
    entrar,
    cadastrar,
    sair,
  };
});
