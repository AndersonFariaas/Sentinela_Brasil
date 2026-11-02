<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import CabecalhoPagina from '@/components/CabecalhoPagina.vue';
import EstadoCarregando from '@/components/EstadoCarregando.vue';
import EstadoErro from '@/components/EstadoErro.vue';
import EstadoVazio from '@/components/EstadoVazio.vue';
import SeveridadeBadge from '@/components/SeveridadeBadge.vue';
import { formatarData } from '@/constantes/ameacas';
import { ROTULOS_CLASSIFICACAO } from '@/constantes/scanner';
import { ErroApi } from '@/services/api';
import { excluirAnalise, listarHistorico, type ResumoAnalise } from '@/services/scans';
import { useSessaoStore } from '@/stores/sessao';

const LIMITE_POR_PAGINA = 20;

const sessao = useSessaoStore();

const itens = ref<ResumoAnalise[]>([]);
const paginaAtual = ref(0);
const temMais = ref(false);
const carregando = ref(false);
const erro = ref<string | null>(null);
const confirmandoId = ref<string | null>(null);
const excluindoId = ref<string | null>(null);
const erroExclusao = ref<string | null>(null);

const MENSAGEM_SESSAO = 'Sua sessão expirou. Entre novamente.';

function mensagemDeErro(falha: unknown): string {
  if (falha instanceof ErroApi && falha.status === 401) {
    return MENSAGEM_SESSAO;
  }
  return 'Não foi possível carregar o histórico. Tente novamente.';
}

/** Busca a página indicada. Com novaBusca, recomeça da primeira página e substitui a lista. */
async function carregar(novaBusca: boolean): Promise<void> {
  const token = sessao.sessao?.access_token;
  if (!token) {
    erro.value = MENSAGEM_SESSAO;
    return;
  }

  const paginaAlvo = novaBusca ? 1 : paginaAtual.value + 1;
  carregando.value = true;
  erro.value = null;

  try {
    const pagina = await listarHistorico(token, paginaAlvo, LIMITE_POR_PAGINA);

    itens.value = novaBusca ? pagina.itens : [...itens.value, ...pagina.itens];
    paginaAtual.value = paginaAlvo;
    temMais.value = pagina.temMais;
  } catch (falha) {
    erro.value = mensagemDeErro(falha);
  } finally {
    carregando.value = false;
  }
}

async function excluir(id: string): Promise<void> {
  const token = sessao.sessao?.access_token;
  if (!token) {
    erroExclusao.value = MENSAGEM_SESSAO;
    return;
  }

  excluindoId.value = id;
  erroExclusao.value = null;

  try {
    await excluirAnalise(token, id);
    itens.value = itens.value.filter((item) => item.id !== id);
  } catch (falha) {
    // 404 quer dizer que o registro já sumiu. Na lista, tratamos como excluído.
    if (falha instanceof ErroApi && falha.status === 404) {
      itens.value = itens.value.filter((item) => item.id !== id);
    } else {
      erroExclusao.value =
        falha instanceof ErroApi && falha.status === 401
          ? MENSAGEM_SESSAO
          : 'Não foi possível excluir esta análise. Tente novamente.';
    }
  } finally {
    excluindoId.value = null;
    confirmandoId.value = null;
  }
}

onMounted(() => void carregar(true));
</script>

<template>
  <div class="space-y-6">
    <CabecalhoPagina
      titulo="Histórico"
      apoio="Suas análises ficam guardadas aqui. Você pode excluir qualquer uma delas."
    />

    <EstadoCarregando v-if="carregando && itens.length === 0" texto="Carregando histórico…" />

    <div v-else-if="erro" class="space-y-3">
      <EstadoErro :mensagem="erro" />
      <button type="button" class="botao-secundario" @click="carregar(itens.length === 0)">
        Tentar de novo
      </button>
    </div>

    <EstadoVazio
      v-else-if="itens.length === 0"
      titulo="Nenhuma análise ainda"
      descricao="Suas análises aparecem aqui depois da primeira verificação de endereço."
    />

    <template v-else>
      <EstadoErro v-if="erroExclusao" :mensagem="erroExclusao" />

      <ul class="space-y-3" aria-label="Análises anteriores">
        <li v-for="item in itens" :key="item.id" class="cartao space-y-3">
          <div class="flex flex-wrap items-center gap-2 text-sm text-texto-suave">
            <span>{{ ROTULOS_CLASSIFICACAO[item.classificacao] }}</span>
            <span aria-hidden="true">·</span>
            <SeveridadeBadge :severidade="item.nivel" />
            <span aria-hidden="true">·</span>
            <span>Pontuação {{ String(item.pontuacao) }} de 100</span>
          </div>

          <p class="break-all font-semibold">{{ item.host }}</p>
          <p class="text-sm text-texto-suave">Analisado em {{ formatarData(item.criadaEm) }}</p>

          <div class="flex flex-wrap items-center gap-3">
            <RouterLink
              :to="{ name: 'resultado', params: { id: item.id } }"
              class="link inline-flex min-h-11 items-center"
            >
              Ver resultado
            </RouterLink>

            <template v-if="confirmandoId !== item.id">
              <button
                type="button"
                class="botao-secundario text-risco"
                :aria-label="`Excluir análise de ${item.host}`"
                @click="confirmandoId = item.id"
              >
                Excluir
              </button>
            </template>

            <template v-else>
              <span class="text-sm">Excluir esta análise?</span>
              <button
                type="button"
                class="botao-secundario text-risco"
                :disabled="excluindoId === item.id"
                @click="excluir(item.id)"
              >
                {{ excluindoId === item.id ? 'Excluindo…' : 'Sim, excluir' }}
              </button>
              <button
                type="button"
                class="botao-secundario"
                :disabled="excluindoId === item.id"
                @click="confirmandoId = null"
              >
                Cancelar
              </button>
            </template>
          </div>
        </li>
      </ul>

      <button
        v-if="temMais"
        type="button"
        class="botao-secundario w-full sm:w-auto"
        :disabled="carregando"
        @click="carregar(false)"
      >
        {{ carregando ? 'Carregando…' : 'Carregar mais' }}
      </button>
    </template>
  </div>
</template>
