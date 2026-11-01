<script setup lang="ts">
import { Inbox } from 'lucide-vue-next';

defineProps<{ titulo: string; descricao?: string }>();
</script>

<template>
  <section class="cartao flex flex-col items-center gap-3 border-dashed p-8 text-center">
    <Inbox class="size-8 text-texto-suave" aria-hidden="true" />
    <h2 class="text-lg font-semibold">{{ titulo }}</h2>
    <p v-if="descricao" class="max-w-prose text-texto-suave">{{ descricao }}</p>
  </section>
</template>
