<script setup lang="ts">
import CabecalhoPagina from '@/components/CabecalhoPagina.vue';
import EstadoVazio from '@/components/EstadoVazio.vue';
</script>

<template>
  <div class="space-y-6">
    <CabecalhoPagina titulo="Histórico" apoio="Suas análises ficam guardadas aqui." />
    <EstadoVazio
      titulo="Nenhuma análise ainda"
      descricao="Suas análises aparecem aqui depois da primeira verificação de endereço."
    />
  </div>
</template>
