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
    <CabecalhoPagina titulo="Detalhes da ameaça" :apoio="`Identificador: ${identificador}`" />
    <EstadoVazio
      titulo="Detalhes indisponíveis por enquanto"
      descricao="Indicadores, evidências e fontes de origem aparecem quando a coleta estiver ativa (Fase 4)."
    />
  </div>
</template>
