<script setup lang="ts">
import { CircleCheck, CircleX, ScanSearch } from 'lucide-vue-next';
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import CabecalhoPagina from '@/components/CabecalhoPagina.vue';
import CartaoAmeaca from '@/components/CartaoAmeaca.vue';
import EstadoCarregando from '@/components/EstadoCarregando.vue';
import EstadoErro from '@/components/EstadoErro.vue';
import EstadoVazio from '@/components/EstadoVazio.vue';
import { verificarSaudeDaApi } from '@/services/api';
import { listarAmeacas, type Ameaca } from '@/services/ameacas';
import { useSessaoStore } from '@/stores/sessao';

type StatusApi = 'verificando' | 'online' | 'indisponivel';

const LIMITE_RECENTES = 3;

const sessao = useSessaoStore();

const statusApi = ref<StatusApi>('verificando');
const recentes = ref<Ameaca[]>([]);
const carregandoRecentes = ref(true);
const erroRecentes = ref<string | null>(null);

async function carregarRecentes(): Promise<void> {
  const token = sessao.sessao?.access_token;
  if (!token) {
    erroRecentes.value = 'Sua sessão expirou. Entre novamente.';
    carregandoRecentes.value = false;
    return;
  }

  carregandoRecentes.value = true;
  erroRecentes.value = null;

  try {
    const lista = await listarAmeacas(token, { pagina: 1, limite: LIMITE_RECENTES });
    recentes.value = lista.itens;
  } catch {
    erroRecentes.value = 'Não foi possível carregar as ameaças recentes. Tente novamente.';
  } finally {
    carregandoRecentes.value = false;
  }
}

onMounted(async () => {
  statusApi.value = (await verificarSaudeDaApi()) ? 'online' : 'indisponivel';
});
onMounted(() => void carregarRecentes());
</script>

<template>
  <div class="space-y-8">
    <CabecalhoPagina titulo="Painel" apoio="Visão geral da sua proteção." />

    <section
      class="cartao flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      aria-labelledby="titulo-analise"
    >
      <div class="space-y-1">
        <h2 id="titulo-analise" class="font-semibold">Quer verificar um endereço?</h2>
        <p class="text-sm text-texto-suave">
          O endereço é analisado sem ser aberto. Você recebe os sinais de risco encontrados.
        </p>
      </div>
      <RouterLink :to="{ name: 'detector' }" class="botao-primario sm:w-auto sm:shrink-0">
        <ScanSearch class="size-4" aria-hidden="true" />
        Analisar um endereço
      </RouterLink>
    </section>

    <section class="space-y-3" aria-labelledby="titulo-recentes">
      <div class="flex items-center justify-between gap-3">
        <h2 id="titulo-recentes" class="text-lg font-semibold">Ameaças recentes</h2>
        <RouterLink :to="{ name: 'ameacas' }" class="link text-sm">Ver todas</RouterLink>
      </div>

      <EstadoCarregando v-if="carregandoRecentes" texto="Carregando ameaças…" />

      <div v-else-if="erroRecentes" class="space-y-3">
        <EstadoErro :mensagem="erroRecentes" />
        <button type="button" class="botao-secundario" @click="carregarRecentes">
          Tentar de novo
        </button>
      </div>

      <EstadoVazio
        v-else-if="recentes.length === 0"
        titulo="Nenhuma ameaça coletada ainda"
        descricao="As ameaças aparecem aqui depois da coleta das fontes ativas."
      />

      <ul v-else class="space-y-3" aria-label="Ameaças recentes">
        <li v-for="ameaca in recentes" :key="ameaca.id">
          <CartaoAmeaca :ameaca="ameaca" />
        </li>
      </ul>
    </section>

    <section class="cartao flex items-center gap-3" aria-labelledby="titulo-status">
      <h2 id="titulo-status" class="font-semibold">Status da API</h2>

      <EstadoCarregando v-if="statusApi === 'verificando'" texto="verificando…" />
      <span v-else-if="statusApi === 'online'" class="inline-flex items-center gap-1.5 text-acao">
        <CircleCheck class="size-5" aria-hidden="true" />
        online
      </span>
      <span v-else class="inline-flex items-center gap-1.5 text-risco">
        <CircleX class="size-5" aria-hidden="true" />
        indisponível
      </span>
    </section>
  </div>
</template>
