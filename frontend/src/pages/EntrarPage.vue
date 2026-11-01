<script setup lang="ts">
import { reactive, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
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
  <main class="mx-auto max-w-sm p-6">
    <h1 class="text-2xl font-bold">Entrar</h1>

    <form novalidate class="mt-6 space-y-4" @submit.prevent="enviar">
      <div>
        <label for="email">E-mail</label>
        <input
          id="email"
          v-model.trim="formulario.email"
          type="email"
          autocomplete="email"
          class="min-h-11 w-full"
          :aria-invalid="erros.email !== undefined"
          aria-describedby="erro-email"
        />
        <p v-if="erros.email" id="erro-email">{{ erros.email }}</p>
      </div>

      <div>
        <label for="senha">Senha</label>
        <input
          id="senha"
          v-model="formulario.senha"
          type="password"
          autocomplete="current-password"
          class="min-h-11 w-full"
          :aria-invalid="erros.senha !== undefined"
          aria-describedby="erro-senha"
        />
        <p v-if="erros.senha" id="erro-senha">{{ erros.senha }}</p>
      </div>

      <p v-if="erroGeral" role="alert">{{ erroGeral }}</p>

      <button type="submit" class="min-h-11 w-full" :disabled="enviando">
        {{ enviando ? 'Entrando…' : 'Entrar' }}
      </button>
    </form>

    <p class="mt-6">
      Ainda não tem conta?
      <RouterLink :to="{ name: 'cadastro' }" class="min-h-11">Criar conta</RouterLink>
    </p>
  </main>
</template>
