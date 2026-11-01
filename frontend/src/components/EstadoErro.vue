<script setup lang="ts">
import { TriangleAlert } from 'lucide-vue-next';

defineProps<{ mensagem: string }>();
</script>

<template>
  <p role="alert" class="alerta flex items-start gap-2">
    <TriangleAlert class="mt-0.5 size-5 shrink-0 text-risco" aria-hidden="true" />
    <span>{{ mensagem }}</span>
  </p>
</template>
