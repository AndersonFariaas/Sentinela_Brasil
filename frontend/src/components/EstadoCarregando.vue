<script setup lang="ts">
withDefaults(defineProps<{ texto?: string }>(), { texto: 'Carregando…' });
</script>

<template>
  <span role="status" aria-live="polite" class="text-texto-suave">{{ texto }}</span>
</template>
