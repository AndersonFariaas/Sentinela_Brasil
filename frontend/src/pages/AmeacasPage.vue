<script setup lang="ts">
import EstadoVazio from '@/components/EstadoVazio.vue';
</script>

<template>
  <section class="p-6">
    <h1 class="text-2xl font-bold">Threat Intelligence</h1>
    <div class="mt-6">
      <EstadoVazio
        titulo="Nenhuma ameaça coletada ainda"
        descricao="O feed é alimentado pela coleta de fontes como CISA KEV, URLhaus e CERT.br (Fase 4)."
      />
    </div>
  </section>
</template>
