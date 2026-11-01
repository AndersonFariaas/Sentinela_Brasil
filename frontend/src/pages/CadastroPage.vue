<script setup lang="ts">
import { reactive, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
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
  <main class="mx-auto max-w-sm p-6">
    <h1 class="text-2xl font-bold">Criar conta</h1>

    <section v-if="emailParaConfirmar" class="mt-6" aria-live="polite">
      <p>
        Enviamos um link de confirmação para <strong>{{ emailParaConfirmar }}</strong
        >. Abra o link para ativar sua conta e depois entre.
      </p>
      <p class="mt-4">
        <RouterLink :to="{ name: 'entrar' }" class="min-h-11">Ir para a tela de entrar</RouterLink>
      </p>
    </section>

    <form v-else novalidate class="mt-6 space-y-4" @submit.prevent="enviar">
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
          autocomplete="new-password"
          class="min-h-11 w-full"
          :aria-invalid="erros.senha !== undefined"
          aria-describedby="erro-senha"
        />
        <p v-if="erros.senha" id="erro-senha">{{ erros.senha }}</p>
      </div>

      <div>
        <label for="confirmar-senha">Confirmar senha</label>
        <input
          id="confirmar-senha"
          v-model="formulario.confirmarSenha"
          type="password"
          autocomplete="new-password"
          class="min-h-11 w-full"
          :aria-invalid="erros.confirmarSenha !== undefined"
          aria-describedby="erro-confirmar-senha"
        />
        <p v-if="erros.confirmarSenha" id="erro-confirmar-senha">{{ erros.confirmarSenha }}</p>
      </div>

      <p v-if="erroGeral" role="alert">{{ erroGeral }}</p>

      <button type="submit" class="min-h-11 w-full" :disabled="enviando">
        {{ enviando ? 'Criando conta…' : 'Criar conta' }}
      </button>
    </form>

    <p v-if="!emailParaConfirmar" class="mt-6">
      Já tem conta?
      <RouterLink :to="{ name: 'entrar' }" class="min-h-11">Entrar</RouterLink>
    </p>
  </main>
</template>
