<script setup lang="ts">
defineProps<{ titulo: string; descricao?: string }>();
</script>

<template>
  <section class="rounded-lg border border-dashed p-8 text-center">
    <h2 class="text-lg font-semibold">{{ titulo }}</h2>
    <p v-if="descricao" class="mt-2 text-sm">{{ descricao }}</p>
  </section>
</template>
