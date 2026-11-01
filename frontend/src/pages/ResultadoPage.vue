<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import EstadoVazio from '@/components/EstadoVazio.vue';

const rota = useRoute();
const identificador = computed(() => String(rota.params.id));
</script>

<template>
  <section class="p-6">
    <h1 class="text-2xl font-bold">Resultado da análise</h1>
    <p class="mt-2 text-sm">Análise: {{ identificador }}</p>
    <div class="mt-6">
      <EstadoVazio
        titulo="Resultado disponível na Fase 5"
        descricao="Classificação, pontuação, evidências e justificativa aparecem quando o detector estiver ativo."
      />
    </div>
  </section>
</template>
