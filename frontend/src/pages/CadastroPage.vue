<script setup lang="ts">
import { reactive, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import CabecalhoPagina from '@/components/CabecalhoPagina.vue';
import CampoFormulario from '@/components/CampoFormulario.vue';
import EstadoErro from '@/components/EstadoErro.vue';
import MarcaSentinela from '@/components/MarcaSentinela.vue';
import { cadastroSchema } from '@/schemas/autenticacao';
import { errosPorCampo } from '@/schemas/erros';
import { ErroAutenticacao, useSessaoStore } from '@/stores/sessao';

const sessao = useSessaoStore();
const router = useRouter();

const formulario = reactive({ email: '', senha: '', confirmarSenha: '' });
const erros = ref<Record<string, string>>({});
const erroGeral = ref('');
const enviando = ref(false);
const emailParaConfirmar = ref<string | null>(null);

async function enviar(): Promise<void> {
  erroGeral.value = '';

  const resultado = cadastroSchema.safeParse(formulario);
  if (!resultado.success) {
    erros.value = errosPorCampo(resultado.error);
    return;
  }

  erros.value = {};
  enviando.value = true;

  try {
    const situacao = await sessao.cadastrar(resultado.data.email, resultado.data.senha);

    if (situacao === 'conta-criada') {
      await router.push({ name: 'painel' });
      return;
    }

    emailParaConfirmar.value = resultado.data.email;
  } catch (error) {
    erroGeral.value =
      error instanceof ErroAutenticacao
        ? error.message
        : 'Algo inesperado aconteceu. Tente novamente.';
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <main class="mx-auto max-w-sm space-y-6 px-4 py-8">
    <MarcaSentinela />
    <CabecalhoPagina
      titulo="Criar conta"
      apoio="Crie sua conta para acompanhar ameaças e verificar endereços."
    />

    <section v-if="emailParaConfirmar" class="cartao space-y-4" role="status">
      <h2 class="text-lg font-semibold">Confirme seu e-mail antes de entrar</h2>
      <p>
        Enviamos um link de confirmação para <strong>{{ emailParaConfirmar }}</strong
        >.
      </p>
      <ol class="list-decimal space-y-2 pl-5">
        <li>Abra o e-mail e procure a mensagem do SENTINELA. Confira também o spam.</li>
        <li>Clique no link de confirmação.</li>
        <li>Volte aqui e entre com o mesmo e-mail e senha.</li>
      </ol>
      <p class="text-texto-suave text-sm">Sem a confirmação, o login não funciona.</p>
      <RouterLink :to="{ name: 'entrar' }" class="botao-primario"
        >Já confirmei, quero entrar</RouterLink
      >
    </section>

    <form v-else novalidate class="space-y-4" @submit.prevent="enviar">
      <CampoFormulario
        id="email"
        v-model="formulario.email"
        rotulo="E-mail"
        tipo="email"
        autocomplete="email"
        :erro="erros.email"
      />
      <CampoFormulario
        id="senha"
        v-model="formulario.senha"
        rotulo="Senha"
        tipo="password"
        autocomplete="new-password"
        :erro="erros.senha"
      />
      <CampoFormulario
        id="confirmarSenha"
        v-model="formulario.confirmarSenha"
        rotulo="Confirmar senha"
        tipo="password"
        autocomplete="new-password"
        :erro="erros.confirmarSenha"
      />

      <EstadoErro v-if="erroGeral" :mensagem="erroGeral" />

      <button type="submit" class="botao-primario" :disabled="enviando">
        {{ enviando ? 'Criando conta…' : 'Criar conta' }}
      </button>
    </form>

    <p v-if="!emailParaConfirmar" class="text-texto-suave">
      Já tem conta?
      <RouterLink :to="{ name: 'entrar' }" class="link">Entrar</RouterLink>
    </p>
  </main>
</template>
