<script setup lang="ts">
import CabecalhoPagina from '@/components/CabecalhoPagina.vue';
import EstadoVazio from '@/components/EstadoVazio.vue';
</script>

<template>
  <div class="space-y-6">
    <CabecalhoPagina
      titulo="Threat Intelligence"
      apoio="Ameaças coletadas de fontes públicas, com a origem de cada informação."
    />
    <EstadoVazio
      titulo="Nenhuma ameaça coletada ainda"
      descricao="O feed é alimentado pela coleta de fontes como CISA KEV, URLhaus e CERT.br (Fase 4)."
    />
  </div>
</template>
