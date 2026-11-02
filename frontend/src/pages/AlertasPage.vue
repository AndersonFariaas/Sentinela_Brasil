<script setup lang="ts">
import { onMounted, ref } from 'vue';
import CabecalhoPagina from '@/components/CabecalhoPagina.vue';
import EstadoCarregando from '@/components/EstadoCarregando.vue';
import EstadoErro from '@/components/EstadoErro.vue';
import { ROTULOS_CATEGORIA, type Categoria } from '@/constantes/ameacas';
import { ErroApi } from '@/services/api';
import { definirInscricao, listarInscricoes, type Inscricao } from '@/services/inscricoes';
import { useSessaoStore } from '@/stores/sessao';

const MENSAGEM_SESSAO = 'Sua sessão expirou. Entre novamente.';

const sessao = useSessaoStore();

const inscricoes = ref<Inscricao[]>([]);
const carregando = ref(true);
const erro = ref<string | null>(null);
const salvando = ref<Categoria | null>(null);

function mensagemDeErro(falha: unknown): string {
  if (falha instanceof ErroApi && falha.status === 401) {
    return MENSAGEM_SESSAO;
  }
  return 'Não foi possível salvar a alteração. Tente novamente.';
}

function definirEstadoLocal(categoria: Categoria, ativa: boolean): void {
  inscricoes.value = inscricoes.value.map((item) =>
    item.categoria === categoria ? { ...item, ativa } : item,
  );
}

async function carregar(): Promise<void> {
  const token = sessao.sessao?.access_token;
  if (!token) {
    erro.value = MENSAGEM_SESSAO;
    carregando.value = false;
    return;
  }

  carregando.value = true;
  erro.value = null;

  try {
    inscricoes.value = await listarInscricoes(token);
  } catch (falha) {
    erro.value = mensagemDeErro(falha);
  } finally {
    carregando.value = false;
  }
}

/** Muda na hora para parecer rápido. Se o servidor recusar, volta ao estado anterior. */
async function alternar(categoria: Categoria): Promise<void> {
  const token = sessao.sessao?.access_token;
  const atual = inscricoes.value.find((item) => item.categoria === categoria);
  if (!token || !atual || salvando.value === categoria) {
    return;
  }

  const novoValor = !atual.ativa;
  salvando.value = categoria;
  erro.value = null;
  definirEstadoLocal(categoria, novoValor);

  try {
    const gravada = await definirInscricao(token, categoria, novoValor);
    definirEstadoLocal(categoria, gravada.ativa);
  } catch (falha) {
    definirEstadoLocal(categoria, !novoValor);
    erro.value = mensagemDeErro(falha);
  } finally {
    salvando.value = null;
  }
}

onMounted(() => void carregar());
</script>

<template>
  <div class="space-y-6">
    <CabecalhoPagina
      titulo="Alertas"
      apoio="Escolha as categorias de ameaça que você quer receber por e-mail."
    />

    <EstadoCarregando v-if="carregando" texto="Carregando suas inscrições…" />

    <div v-else-if="erro && inscricoes.length === 0" class="space-y-3">
      <EstadoErro :mensagem="erro" />
      <button type="button" class="botao-secundario" @click="carregar">Tentar de novo</button>
    </div>

    <template v-else>
      <EstadoErro v-if="erro" :mensagem="erro" />

      <ul class="space-y-3" aria-label="Categorias de alerta">
        <li
          v-for="item in inscricoes"
          :key="item.categoria"
          class="cartao flex items-center justify-between gap-4"
        >
          <span :id="`rotulo-${item.categoria}`" class="font-semibold">
            {{ ROTULOS_CATEGORIA[item.categoria] }}
          </span>

          <button
            type="button"
            role="switch"
            :aria-checked="item.ativa ? 'true' : 'false'"
            :aria-labelledby="`rotulo-${item.categoria}`"
            :disabled="salvando === item.categoria"
            class="relative inline-flex h-11 w-14 shrink-0 items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
            @click="alternar(item.categoria)"
          >
            <span
              aria-hidden="true"
              class="block h-6 w-11 rounded-full border border-borda transition-colors motion-reduce:transition-none"
              :class="item.ativa ? 'bg-info' : 'bg-superficie'"
            />
            <span
              aria-hidden="true"
              class="absolute left-1 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white transition-transform motion-reduce:transition-none"
              :class="item.ativa ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </li>
      </ul>

      <p class="text-sm text-texto-suave">
        Você também pode cancelar pelo link no próprio e-mail. Cada alerta traz o botão de cancelar.
      </p>
    </template>
  </div>
</template>
