<script setup lang="ts">
import { ref } from 'vue';
import CabecalhoPagina from '@/components/CabecalhoPagina.vue';
import CampoFormulario from '@/components/CampoFormulario.vue';
import { urlSuspeitaSchema } from '@/schemas/url';

const url = ref('');
const erro = ref<string | undefined>(undefined);
const aguardandoBackend = ref(false);

function verificar(): void {
  aguardandoBackend.value = false;

  const resultado = urlSuspeitaSchema.safeParse(url.value);
  if (!resultado.success) {
    erro.value = resultado.error.issues[0]?.message ?? 'URL inválida.';
    return;
  }

  erro.value = undefined;
  // A validação acima só orienta o usuário. A decisão é tomada no servidor (Fase 5).
  aguardandoBackend.value = true;
}
</script>

<template>
  <div class="space-y-6">
    <CabecalhoPagina
      titulo="Detector de phishing"
      apoio="Informe um endereço para verificar se há sinais de risco."
    />

    <form novalidate class="cartao max-w-xl space-y-4" @submit.prevent="verificar">
      <CampoFormulario
        id="url"
        v-model="url"
        rotulo="Endereço (URL)"
        tipo="url"
        autocomplete="off"
        :erro="erro"
      />
      <button type="submit" class="botao-primario sm:w-auto">Verificar</button>
    </form>

    <p v-if="aguardandoBackend" role="status" class="cartao max-w-xl">
      O endereço é válido. A análise chega na Fase 5, quando o servidor passar a responder.
    </p>
  </div>
</template>
