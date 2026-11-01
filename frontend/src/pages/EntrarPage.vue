<script setup lang="ts">
import { reactive, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import CampoFormulario from '@/components/CampoFormulario.vue';
import CabecalhoPagina from '@/components/CabecalhoPagina.vue';
import EstadoErro from '@/components/EstadoErro.vue';
import { entrarSchema } from '@/schemas/autenticacao';
import { errosPorCampo } from '@/schemas/erros';
import { destinoSeguro } from '@/router';
import { ErroAutenticacao, useSessaoStore } from '@/stores/sessao';

const sessao = useSessaoStore();
const router = useRouter();
const rota = useRoute();

const formulario = reactive({ email: '', senha: '' });
const erros = ref<Record<string, string>>({});
const erroGeral = ref('');
const enviando = ref(false);

async function enviar(): Promise<void> {
  erroGeral.value = '';

  const resultado = entrarSchema.safeParse(formulario);
  if (!resultado.success) {
    erros.value = errosPorCampo(resultado.error);
    return;
  }

  erros.value = {};
  enviando.value = true;

  try {
    await sessao.entrar(resultado.data.email, resultado.data.senha);
    await router.push(destinoSeguro(rota.query.redirect));
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
    <CabecalhoPagina titulo="Entrar" apoio="Use o e-mail e a senha da sua conta." />

    <form novalidate class="space-y-4" @submit.prevent="enviar">
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
        autocomplete="current-password"
        :erro="erros.senha"
      />

      <EstadoErro v-if="erroGeral" :mensagem="erroGeral" />

      <button type="submit" class="botao-primario" :disabled="enviando">
        {{ enviando ? 'Entrando…' : 'Entrar' }}
      </button>
    </form>

    <p class="text-texto-suave">
      Ainda não tem conta?
      <RouterLink :to="{ name: 'cadastro' }" class="link">Criar conta</RouterLink>
    </p>
  </main>
</template>
