<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import CabecalhoPagina from '@/components/CabecalhoPagina.vue';
import EstadoVazio from '@/components/EstadoVazio.vue';

const rota = useRoute();
const identificador = computed(() => String(rota.params.id));
</script>

<template>
  <div class="space-y-6">
    <CabecalhoPagina titulo="Resultado da análise" :apoio="`Análise: ${identificador}`" />
    <EstadoVazio
      titulo="Resultado disponível na Fase 5"
      descricao="Classificação, pontuação, evidências e justificativa aparecem quando o detector estiver ativo."
    />
  </div>
</template>
