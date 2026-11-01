<script setup lang="ts">
withDefaults(defineProps<{ texto?: string }>(), { texto: 'Carregando…' });
</script>

<template>
  <p role="status" aria-live="polite">{{ texto }}</p>
</template>
