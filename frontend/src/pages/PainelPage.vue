<script setup lang="ts">
import { CircleCheck, CircleX } from 'lucide-vue-next';
import { onMounted, ref } from 'vue';
import CabecalhoPagina from '@/components/CabecalhoPagina.vue';
import EstadoCarregando from '@/components/EstadoCarregando.vue';
import EstadoVazio from '@/components/EstadoVazio.vue';
import { verificarSaudeDaApi } from '@/services/api';

type StatusApi = 'verificando' | 'online' | 'indisponivel';

const statusApi = ref<StatusApi>('verificando');

onMounted(async () => {
  statusApi.value = (await verificarSaudeDaApi()) ? 'online' : 'indisponivel';
});
</script>

<template>
  <div class="space-y-6">
    <CabecalhoPagina titulo="Painel" apoio="Visão geral da sua proteção." />

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

    <EstadoVazio
      titulo="Nenhum indicador ainda"
      descricao="Os indicadores aparecem quando a coleta de fontes públicas estiver ativa (Fase 4)."
    />
  </div>
</template>
