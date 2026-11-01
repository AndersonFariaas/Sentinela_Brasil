<script setup lang="ts">
defineProps<{ titulo: string; apoio?: string }>();
</script>

<template>
  <header class="space-y-2">
    <h1 class="text-2xl font-bold sm:text-3xl">{{ titulo }}</h1>
    <p v-if="apoio" class="max-w-prose text-texto-suave">{{ apoio }}</p>
  </header>
</template>
