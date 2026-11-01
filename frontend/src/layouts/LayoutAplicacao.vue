<script setup lang="ts">
import { LogOut, ShieldCheck } from 'lucide-vue-next';
import { ref } from 'vue';
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { ErroAutenticacao, useSessaoStore } from '@/stores/sessao';

const sessao = useSessaoStore();
const router = useRouter();

const erroAoSair = ref('');
const saindo = ref(false);

const itensNavegacao = [
  { rota: 'painel', rotulo: 'Painel' },
  { rota: 'ameacas', rotulo: 'Threat Intelligence' },
  { rota: 'detector', rotulo: 'Detector' },
  { rota: 'historico', rotulo: 'Histórico' },
] as const;

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
  <div class="min-h-dvh">
    <a
      href="#conteudo"
      class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-acao focus:px-4 focus:py-2 focus:text-acao-texto"
    >
      Pular para o conteúdo
    </a>

    <header class="border-b border-borda bg-superficie">
      <div class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <RouterLink
          :to="{ name: 'painel' }"
          class="inline-flex min-h-11 items-center gap-2 text-lg font-bold tracking-wide"
        >
          <ShieldCheck class="size-6 text-acao" aria-hidden="true" />
          SENTINELA
        </RouterLink>

        <div class="flex items-center gap-3">
          <span class="hidden text-sm text-texto-suave sm:inline">
            {{ sessao.perfil?.email ?? sessao.sessao?.user.email }}
          </span>
          <button type="button" class="botao-secundario" :disabled="saindo" @click="sair">
            <LogOut class="size-4" aria-hidden="true" />
            {{ saindo ? 'Saindo…' : 'Sair' }}
          </button>
        </div>
      </div>

      <!-- Quebra em linhas no celular: um item escondido por rolagem seria um item que o usuário não vê. -->
      <nav aria-label="Principal" class="mx-auto max-w-5xl px-4 pb-2">
        <ul class="flex flex-wrap gap-1">
          <li v-for="item in itensNavegacao" :key="item.rota">
            <RouterLink
              :to="{ name: item.rota }"
              class="inline-flex min-h-11 items-center rounded-md px-3 text-texto-suave hover:text-texto"
              active-class="bg-fundo !text-acao"
            >
              {{ item.rotulo }}
            </RouterLink>
          </li>
        </ul>
      </nav>

      <p v-if="erroAoSair" role="alert" class="mx-auto max-w-5xl px-4 pb-3 text-risco">
        {{ erroAoSair }}
      </p>
    </header>

    <main id="conteudo" tabindex="-1" class="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <RouterView />
    </main>
  </div>
</template>
