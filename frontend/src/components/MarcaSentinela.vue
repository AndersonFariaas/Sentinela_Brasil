<script setup lang="ts">
import { ShieldCheck } from 'lucide-vue-next';
</script>

<template>
  <div class="flex items-center gap-3">
    <span class="grid size-11 place-items-center rounded-xl border border-borda bg-superficie">
      <ShieldCheck class="size-6 text-acao" aria-hidden="true" />
    </span>
    <div>
      <p class="text-lg font-bold tracking-wide">SENTINELA</p>
      <p class="text-sm text-texto-suave">Inteligência que antecipa ameaças.</p>
    </div>
  </div>
</template>
