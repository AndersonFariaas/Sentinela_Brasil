<script setup lang="ts">
import { ShieldCheck } from 'lucide-vue-next';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import SeveridadeBadge from '@/components/SeveridadeBadge.vue';
import { formatarData, ROTULOS_CATEGORIA } from '@/constantes/ameacas';
import type { Ameaca } from '@/services/ameacas';

const props = defineProps<{ ameaca: Ameaca }>();

// "Confirmada" é a própria fonte confirmando a ameaça. Não é um juízo do SENTINELA.
const confirmada = computed(() => props.ameaca.estadoVerificacao === 'verificada');
</script>

<template>
  <article class="cartao space-y-3">
    <div class="flex flex-wrap items-center gap-2 text-sm text-texto-suave">
      <span>{{ ROTULOS_CATEGORIA[ameaca.categoria] }}</span>
      <span aria-hidden="true">·</span>
      <SeveridadeBadge :severidade="ameaca.severidade" />
    </div>

    <h2 class="text-lg font-semibold">
      <RouterLink :to="{ name: 'ameaca', params: { id: ameaca.id } }" class="link">
        {{ ameaca.titulo }}
      </RouterLink>
    </h2>

    <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-texto-suave">
      <span
        class="inline-flex items-center gap-1.5 font-semibold"
        :class="confirmada ? 'text-acao' : 'text-texto-suave'"
      >
        <ShieldCheck v-if="confirmada" class="size-4" aria-hidden="true" />
        {{ confirmada ? 'Confirmada pela fonte' : 'Ainda não confirmada' }}
      </span>
      <span aria-hidden="true">·</span>
      <span>Fonte: {{ ameaca.fonte?.nome ?? 'não informada' }}</span>
      <span aria-hidden="true">·</span>
      <span>Publicado em {{ formatarData(ameaca.publicadoEm) }}</span>
    </p>
  </article>
</template>
