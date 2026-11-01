<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { ErroAutenticacao, useSessaoStore } from '@/stores/sessao';

const sessao = useSessaoStore();
const router = useRouter();

const erroAoSair = ref('');
const saindo = ref(false);

async function sair(): Promise<void> {
  erroAoSair.value = '';
  saindo.value = true;

  try {
    await sessao.sair();
    await router.push({ name: 'entrar' });
  } catch (error) {
    erroAoSair.value =
      error instanceof ErroAutenticacao ? error.message : 'Não foi possível sair agora.';
  } finally {
    saindo.value = false;
  }
}
</script>

<template>
  <div>
    <a href="#conteudo" class="sr-only focus:not-sr-only">Pular para o conteúdo</a>

    <header>
      <nav aria-label="Principal">
        <RouterLink :to="{ name: 'painel' }" class="min-h-11">Painel</RouterLink>
        <RouterLink :to="{ name: 'ameacas' }" class="min-h-11">Threat Intelligence</RouterLink>
        <RouterLink :to="{ name: 'detector' }" class="min-h-11">Detector</RouterLink>
        <RouterLink :to="{ name: 'historico' }" class="min-h-11">Histórico</RouterLink>
      </nav>

      <div>
        <span>{{ sessao.perfil?.email ?? sessao.sessao?.user.email }}</span>
        <button type="button" class="min-h-11" :disabled="saindo" @click="sair">
          {{ saindo ? 'Saindo…' : 'Sair' }}
        </button>
      </div>
      <p v-if="erroAoSair" role="alert">{{ erroAoSair }}</p>
    </header>

    <main id="conteudo">
      <RouterView />
    </main>
  </div>
</template>
