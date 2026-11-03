<script setup lang="ts">
import {
  Bell,
  History,
  LayoutDashboard,
  LogOut,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-vue-next';
import { ref } from 'vue';
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { ErroAutenticacao, useSessaoStore } from '@/stores/sessao';

const sessao = useSessaoStore();
const router = useRouter();

const erroAoSair = ref('');
const saindo = ref(false);

// No celular a barra de baixo usa rótulo curto, para caber cinco itens em uma linha.
const itensNavegacao = [
  { rota: 'painel', rotulo: 'Painel', rotuloCurto: 'Painel', icone: LayoutDashboard },
  { rota: 'ameacas', rotulo: 'Threat Intelligence', rotuloCurto: 'Ameaças', icone: ShieldAlert },
  { rota: 'detector', rotulo: 'Detector', rotuloCurto: 'Detector', icone: ScanSearch },
  { rota: 'historico', rotulo: 'Histórico', rotuloCurto: 'Histórico', icone: History },
  { rota: 'alertas', rotulo: 'Alertas', rotuloCurto: 'Alertas', icone: Bell },
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
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
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

      <p v-if="erroAoSair" role="alert" class="mx-auto max-w-5xl px-4 pb-3 text-risco">
        {{ erroAoSair }}
      </p>
    </header>

    <!--
      No celular, a navegação fica fixa embaixo, como nos apps: o polegar alcança e o item
      nunca some por rolagem. Em telas maiores, vira uma faixa logo abaixo do cabeçalho.
    -->
    <nav
      aria-label="Principal"
      class="fixed inset-x-0 bottom-0 z-40 border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)] sm:static sm:border-t-0 sm:border-b sm:pb-0"
    >
      <ul class="mx-auto grid max-w-5xl grid-cols-5 sm:flex sm:gap-1 sm:px-4">
        <li v-for="item in itensNavegacao" :key="item.rota">
          <RouterLink
            :to="{ name: item.rota }"
            class="flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-xs text-texto-suave hover:text-texto sm:min-h-11 sm:flex-row sm:gap-2 sm:rounded-md sm:px-3 sm:text-sm"
            active-class="!text-acao sm:bg-fundo"
          >
            <component :is="item.icone" class="size-5" aria-hidden="true" />
            <span class="sm:hidden">{{ item.rotuloCurto }}</span>
            <span class="hidden sm:inline">{{ item.rotulo }}</span>
          </RouterLink>
        </li>
      </ul>
    </nav>

    <main id="conteudo" tabindex="-1" class="mx-auto max-w-5xl space-y-8 px-4 py-8 pb-28 sm:pb-8">
      <RouterView />
    </main>
  </div>
</template>
