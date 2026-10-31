<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { verificarSaudeDaApi } from '@/services/api';

type StatusApi = 'verificando' | 'online' | 'indisponivel';

const statusApi = ref<StatusApi>('verificando');

const rotuloStatusApi = computed(() => {
  const rotulos: Record<StatusApi, string> = {
    verificando: 'verificando…',
    online: 'online',
    indisponivel: 'indisponível',
  };
  return rotulos[statusApi.value];
});

onMounted(async () => {
  statusApi.value = (await verificarSaudeDaApi()) ? 'online' : 'indisponivel';
});
</script>

<template>
  <main class="min-h-dvh p-6">
    <h1 class="text-3xl font-bold">SENTINELA</h1>
    <p>Inteligência que antecipa ameaças. Tecnologia que protege pessoas.</p>
    <p>Status da API: {{ rotuloStatusApi }}</p>
  </main>
</template>
