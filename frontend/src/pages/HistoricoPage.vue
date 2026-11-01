<script setup lang="ts">
import EstadoVazio from '@/components/EstadoVazio.vue';
</script>

<template>
  <section class="p-6">
    <h1 class="text-2xl font-bold">Histórico</h1>
    <div class="mt-6">
      <EstadoVazio
        titulo="Nenhuma análise ainda"
        descricao="Suas análises aparecem aqui depois da primeira verificação de endereço."
      />
    </div>
  </section>
</template>
