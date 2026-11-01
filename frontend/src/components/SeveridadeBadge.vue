<script setup lang="ts">
import { computed } from 'vue';
import { ROTULOS_SEVERIDADE, type Severidade } from '@/constantes/ameacas';

const props = defineProps<{ severidade: Severidade }>();

// A cor sempre vem junto do texto, então o significado não depende só de cor.
const estilos: Record<Severidade, string> = {
  baixo: 'border-borda text-texto-suave',
  moderado: 'border-info text-info',
  alto: 'border-atencao text-atencao',
  critico: 'border-risco text-risco',
};

const rotulo = computed(() => ROTULOS_SEVERIDADE[props.severidade]);
</script>

<template>
  <span
    class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-sm font-semibold"
    :class="estilos[severidade]"
  >
    {{ rotulo }}
  </span>
</template>
