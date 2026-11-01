<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import CabecalhoPagina from '@/components/CabecalhoPagina.vue';
import CampoFormulario from '@/components/CampoFormulario.vue';
import EstadoErro from '@/components/EstadoErro.vue';
import { urlSuspeitaSchema } from '@/schemas/url';
import { ErroApi } from '@/services/api';
import { criarAnalise, ErroUrlRecusada } from '@/services/scans';
import { useSessaoStore } from '@/stores/sessao';

const roteador = useRouter();
const sessao = useSessaoStore();

const url = ref('');
const erroCampo = ref<string | undefined>(undefined);
const erroGeral = ref<string | null>(null);
const enviando = ref(false);

const MENSAGEM_SESSAO = 'Sua sessão expirou. Entre novamente.';
const MENSAGEM_FALHA = 'Não foi possível analisar o endereço agora. Tente novamente.';

function tratarFalha(falha: unknown): void {
  if (falha instanceof ErroUrlRecusada) {
    erroCampo.value = falha.mensagem;
    return;
  }

  if (falha instanceof ErroApi && falha.status === 401) {
    erroGeral.value = MENSAGEM_SESSAO;
    return;
  }

  console.error('Falha ao analisar a URL', falha);
  erroGeral.value = MENSAGEM_FALHA;
}

async function verificar(): Promise<void> {
  erroGeral.value = null;

  // Validação no cliente só orienta o usuário. Quem decide é o servidor.
  const validacao = urlSuspeitaSchema.safeParse(url.value);
  if (!validacao.success) {
    erroCampo.value = validacao.error.issues[0]?.message ?? 'URL inválida.';
    return;
  }
  erroCampo.value = undefined;

  const token = sessao.sessao?.access_token;
  if (!token) {
    erroGeral.value = MENSAGEM_SESSAO;
    return;
  }

  enviando.value = true;
  try {
    const resultado = await criarAnalise(token, validacao.data);
    await roteador.push({ name: 'resultado', params: { id: resultado.id } });
  } catch (falha) {
    tratarFalha(falha);
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <div class="space-y-6">
    <CabecalhoPagina
      titulo="Detector de phishing"
      apoio="Informe um endereço para verificar sinais de risco. O endereço é analisado sem ser aberto."
    />

    <form novalidate class="cartao max-w-xl space-y-4" @submit.prevent="verificar">
      <CampoFormulario
        id="url"
        v-model="url"
        rotulo="Endereço (URL)"
        tipo="url"
        autocomplete="off"
        :erro="erroCampo"
      />
      <button type="submit" class="botao-primario sm:w-auto" :disabled="enviando">
        {{ enviando ? 'Analisando…' : 'Verificar' }}
      </button>
    </form>

    <p v-if="enviando" role="status" class="cartao max-w-xl text-texto-suave">
      Analisando o endereço. Isso leva alguns segundos.
    </p>

    <EstadoErro v-if="erroGeral" :mensagem="erroGeral" />
  </div>
</template>
