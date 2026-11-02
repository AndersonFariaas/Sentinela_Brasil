<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import CabecalhoPagina from '@/components/CabecalhoPagina.vue';
import EstadoCarregando from '@/components/EstadoCarregando.vue';
import EstadoErro from '@/components/EstadoErro.vue';
import EstadoVazio from '@/components/EstadoVazio.vue';
import SeveridadeBadge from '@/components/SeveridadeBadge.vue';
import {
  CATEGORIAS,
  ROTULOS_CATEGORIA,
  SEVERIDADES,
  ROTULOS_SEVERIDADE,
  formatarData,
  type Categoria,
  type Severidade,
} from '@/constantes/ameacas';
import { ErroApi } from '@/services/api';
import { listarAmeacas, type Ameaca } from '@/services/ameacas';
import { useSessaoStore } from '@/stores/sessao';

const LIMITE_POR_PAGINA = 20;

const sessao = useSessaoStore();

const itens = ref<Ameaca[]>([]);
const paginaAtual = ref(0);
const temMais = ref(false);
const carregando = ref(false);
const erro = ref<string | null>(null);
const categoria = ref<Categoria | ''>('');
const severidade = ref<Severidade | ''>('');

const filtrosAtivos = computed(() => categoria.value !== '' || severidade.value !== '');

function mensagemDeErro(falha: unknown): string {
  if (falha instanceof ErroApi && falha.status === 401) {
    return 'Sua sessão expirou. Entre novamente.';
  }
  return 'Não foi possível carregar as ameaças. Tente novamente.';
}

/** Busca a página indicada. Com novaBusca, recomeça da primeira página e substitui a lista. */
async function carregar(novaBusca: boolean): Promise<void> {
  const token = sessao.sessao?.access_token;
  if (!token) {
    erro.value = 'Sua sessão expirou. Entre novamente.';
    return;
  }

  const paginaAlvo = novaBusca ? 1 : paginaAtual.value + 1;
  carregando.value = true;
  erro.value = null;

  try {
    const lista = await listarAmeacas(token, {
      categoria: categoria.value || undefined,
      severidade: severidade.value || undefined,
      pagina: paginaAlvo,
      limite: LIMITE_POR_PAGINA,
    });

    itens.value = novaBusca ? lista.itens : [...itens.value, ...lista.itens];
    paginaAtual.value = paginaAlvo;
    temMais.value = lista.temMais;
  } catch (falha) {
    erro.value = mensagemDeErro(falha);
  } finally {
    carregando.value = false;
  }
}

onMounted(() => void carregar(true));
watch([categoria, severidade], () => void carregar(true));
</script>

<template>
  <div class="space-y-6">
    <CabecalhoPagina
      titulo="Threat Intelligence"
      apoio="Ameaças coletadas de fontes públicas, com a origem de cada informação."
    />

    <form role="search" aria-label="Filtrar ameaças" class="cartao grid gap-4 sm:grid-cols-2">
      <div>
        <label for="filtro-categoria" class="rotulo">Categoria</label>
        <select id="filtro-categoria" v-model="categoria" class="campo">
          <option value="">Todas</option>
          <option v-for="item in CATEGORIAS" :key="item" :value="item">
            {{ ROTULOS_CATEGORIA[item] }}
          </option>
        </select>
      </div>
      <div>
        <label for="filtro-severidade" class="rotulo">Severidade</label>
        <select id="filtro-severidade" v-model="severidade" class="campo">
          <option value="">Todas</option>
          <option v-for="item in SEVERIDADES" :key="item" :value="item">
            {{ ROTULOS_SEVERIDADE[item] }}
          </option>
        </select>
      </div>
    </form>

    <EstadoCarregando v-if="carregando && itens.length === 0" texto="Carregando ameaças…" />

    <div v-else-if="erro" class="space-y-3">
      <EstadoErro :mensagem="erro" />
      <button type="button" class="botao-secundario" @click="carregar(itens.length === 0)">
        Tentar de novo
      </button>
    </div>

    <EstadoVazio
      v-else-if="itens.length === 0"
      :titulo="filtrosAtivos ? 'Nenhuma ameaça com esses filtros' : 'Nenhuma ameaça coletada ainda'"
      :descricao="
        filtrosAtivos
          ? 'Tente outra categoria ou severidade.'
          : 'O feed é alimentado pela coleta das fontes ativas.'
      "
    />

    <template v-else>
      <ul class="space-y-3" aria-label="Lista de ameaças">
        <li v-for="ameaca in itens" :key="ameaca.id" class="cartao space-y-3">
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

          <p class="text-sm text-texto-suave">
            Fonte: {{ ameaca.fonte?.nome ?? 'não informada' }} · Publicado em
            {{ formatarData(ameaca.publicadoEm) }}
          </p>
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
