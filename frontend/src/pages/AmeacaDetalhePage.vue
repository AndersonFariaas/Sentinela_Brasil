<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import EstadoVazio from '@/components/EstadoVazio.vue';

const rota = useRoute();
const identificador = computed(() => String(rota.params.id));
</script>

<template>
  <section class="p-6">
    <h1 class="text-2xl font-bold">Detalhes da ameaça</h1>
    <p class="mt-2 text-sm">Identificador: {{ identificador }}</p>
    <div class="mt-6">
      <EstadoVazio
        titulo="Detalhes indisponíveis por enquanto"
        descricao="Indicadores, evidências e fontes de origem aparecem quando a coleta estiver ativa (Fase 4)."
      />
    </div>
  </section>
</template>
