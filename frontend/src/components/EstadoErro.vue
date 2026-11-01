<script setup lang="ts">
defineProps<{ mensagem: string }>();
</script>

<template>
  <p role="alert" class="rounded-lg border p-4 text-sm">{{ mensagem }}</p>
</template>
