<script setup lang="ts">
import { ref } from 'vue';
import { urlSuspeitaSchema } from '@/schemas/url';

const url = ref('');
const erro = ref('');
const aguardandoBackend = ref(false);

function verificar(): void {
  aguardandoBackend.value = false;

  const resultado = urlSuspeitaSchema.safeParse(url.value);
  if (!resultado.success) {
    erro.value = resultado.error.issues[0]?.message ?? 'URL inválida.';
    return;
  }

  erro.value = '';
  // A validação acima é só para orientar o usuário. A decisão é tomada no servidor (Fase 5).
  aguardandoBackend.value = true;
}
</script>

<template>
  <section class="p-6">
    <h1 class="text-2xl font-bold">Detector de phishing</h1>
    <p class="mt-2 text-sm">Informe um endereço para verificar se há sinais de risco.</p>

    <form novalidate class="mt-6 space-y-4" @submit.prevent="verificar">
      <div>
        <label for="url">Endereço (URL)</label>
        <input
          id="url"
          v-model.trim="url"
          type="url"
          inputmode="url"
          autocomplete="off"
          placeholder="https://exemplo.com"
          class="min-h-11 w-full"
          :aria-invalid="erro !== ''"
          aria-describedby="erro-url"
        />
        <p v-if="erro" id="erro-url" role="alert">{{ erro }}</p>
      </div>

      <button type="submit" class="min-h-11 w-full">Verificar</button>
    </form>

    <p v-if="aguardandoBackend" class="mt-6" role="status">
      O endereço é válido. A análise chega na Fase 5, quando o servidor passar a responder.
    </p>
  </section>
</template>
