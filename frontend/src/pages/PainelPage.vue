<script setup lang="ts">
import { onMounted, ref } from 'vue';
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
  <section class="p-6">
    <h1 class="text-2xl font-bold">Painel</h1>

    <p class="mt-2">
      Status da API:
      <span v-if="statusApi === 'verificando'">
        <EstadoCarregando texto="verificando…" />
      </span>
      <span v-else>{{ statusApi === 'online' ? 'online' : 'indisponível' }}</span>
    </p>

    <div class="mt-6">
      <EstadoVazio
        titulo="Nenhum indicador ainda"
        descricao="Os indicadores aparecem quando a coleta de fontes públicas estiver ativa (Fase 4)."
      />
    </div>
  </section>
</template>
