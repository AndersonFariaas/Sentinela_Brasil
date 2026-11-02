<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import CabecalhoPagina from '@/components/CabecalhoPagina.vue';
import EstadoCarregando from '@/components/EstadoCarregando.vue';
import EstadoErro from '@/components/EstadoErro.vue';
import EstadoVazio from '@/components/EstadoVazio.vue';
import SeveridadeBadge from '@/components/SeveridadeBadge.vue';
import { formatarData } from '@/constantes/ameacas';
import {
  ROTULOS_CLASSIFICACAO,
  ROTULOS_GRUPO_EVIDENCIA,
  type Classificacao,
} from '@/constantes/scanner';
import { ErroApi } from '@/services/api';
import { buscarAnalise, type Scan } from '@/services/scans';
import { useSessaoStore } from '@/stores/sessao';

const rota = useRoute();
const sessao = useSessaoStore();

const identificador = computed(() => String(rota.params.id));
const resultado = ref<Scan | null>(null);
const carregando = ref(true);
const naoEncontrado = ref(false);
const erro = ref<string | null>(null);

// Cor sempre acompanha o texto do veredito, para o significado não depender só de cor.
const estilosVeredito: Record<Classificacao, { texto: string; barra: string }> = {
  confirmado: { texto: 'text-risco', barra: 'bg-risco' },
  suspeito: { texto: 'text-atencao', barra: 'bg-atencao' },
  nao_identificado: { texto: 'text-texto-suave', barra: 'bg-info' },
};

const estilo = computed(() =>
  resultado.value ? estilosVeredito[resultado.value.classificacao] : null,
);

async function carregar(): Promise<void> {
  const token = sessao.sessao?.access_token;
  if (!token) {
    erro.value = 'Sua sessão expirou. Entre novamente.';
    carregando.value = false;
    return;
  }

  carregando.value = true;
  erro.value = null;
  naoEncontrado.value = false;

  try {
    resultado.value = await buscarAnalise(token, identificador.value);
  } catch (falha) {
    if (falha instanceof ErroApi && falha.status === 404) {
      naoEncontrado.value = true;
    } else if (falha instanceof ErroApi && falha.status === 401) {
      erro.value = 'Sua sessão expirou. Entre novamente.';
    } else {
      console.error('Falha ao carregar o resultado da análise', falha);
      erro.value = 'Não foi possível carregar o resultado. Tente novamente.';
    }
  } finally {
    carregando.value = false;
  }
}

onMounted(() => void carregar());
</script>

<template>
  <div class="space-y-6">
    <RouterLink :to="{ name: 'detector' }" class="link">← Nova análise</RouterLink>

    <EstadoCarregando v-if="carregando" texto="Carregando o resultado…" />

    <EstadoVazio
      v-else-if="naoEncontrado"
      titulo="Resultado não encontrado"
      descricao="Ele pode ter sido removido ou o endereço está incorreto."
    />

    <div v-else-if="erro" class="space-y-3">
      <EstadoErro :mensagem="erro" />
      <button type="button" class="botao-secundario" @click="carregar">Tentar de novo</button>
    </div>

    <template v-else-if="resultado && estilo">
      <CabecalhoPagina
        :titulo="resultado.host"
        :apoio="`Analisado em ${formatarData(resultado.criadaEm)}`"
      />

      <section class="cartao space-y-4" aria-labelledby="titulo-veredito">
        <h2 id="titulo-veredito" class="sr-only">Veredito</h2>

        <div class="flex flex-wrap items-center gap-3">
          <span class="text-lg font-semibold" :class="estilo.texto">
            {{ ROTULOS_CLASSIFICACAO[resultado.classificacao] }}
          </span>
          <SeveridadeBadge :severidade="resultado.nivel" />
        </div>

        <div class="space-y-2">
          <p class="text-sm text-texto-suave">
            Pontuação de risco:
            <strong class="text-texto">{{ String(resultado.pontuacao) }}</strong> de 100
          </p>
          <div
            role="meter"
            aria-label="Pontuação de risco"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="resultado.pontuacao"
            class="h-2 w-full overflow-hidden rounded-full bg-superficie"
          >
            <div
              class="h-full rounded-full"
              :class="estilo.barra"
              :style="{ width: `${String(resultado.pontuacao)}%` }"
            />
          </div>
        </div>

        <p>{{ resultado.analise.resumo }}</p>
      </section>

      <section class="cartao space-y-2" aria-labelledby="titulo-justificativa">
        <h2 id="titulo-justificativa" class="font-semibold">Por que este resultado</h2>
        <p>{{ resultado.analise.justificativa }}</p>
      </section>

      <section class="cartao" aria-labelledby="titulo-evidencias">
        <h2 id="titulo-evidencias" class="mb-3 font-semibold">Evidências</h2>
        <p v-if="resultado.evidencias.length === 0" class="text-texto-suave">
          Nenhum sinal foi encontrado. Isso mostra falta de informação, não garante ausência de
          risco.
        </p>
        <ul v-else class="space-y-4">
          <li v-for="evidencia in resultado.evidencias" :key="evidencia.id" class="space-y-1">
            <p class="flex flex-wrap items-center gap-2">
              <span class="rounded border border-borda px-2 py-0.5 text-xs text-texto-suave">
                {{ ROTULOS_GRUPO_EVIDENCIA[evidencia.grupo] }}
              </span>
              <span class="font-semibold">{{ evidencia.titulo }}</span>
            </p>
            <p class="text-sm text-texto-suave">{{ evidencia.descricao }}</p>
          </li>
        </ul>
      </section>

      <section class="cartao" aria-labelledby="titulo-fontes">
        <h2 id="titulo-fontes" class="mb-3 font-semibold">Fontes consultadas</h2>
        <ul class="space-y-1">
          <li v-for="fonte in resultado.fontes" :key="fonte.nome" class="flex flex-wrap gap-2">
            <span>{{ fonte.nome }}</span>
            <span class="text-texto-suave">
              {{
                fonte.correspondencias === 0
                  ? 'sem correspondência'
                  : `${String(fonte.correspondencias)} correspondência(s)`
              }}
            </span>
          </li>
        </ul>
      </section>

      <section class="cartao" aria-labelledby="titulo-recomendacoes">
        <h2 id="titulo-recomendacoes" class="mb-3 font-semibold">Recomendações</h2>
        <ol class="list-decimal space-y-2 pl-5">
          <li v-for="recomendacao in resultado.analise.recomendacoes" :key="recomendacao">
            {{ recomendacao }}
          </li>
        </ol>
      </section>

      <p class="text-sm text-texto-suave">
        <template v-if="resultado.analise.status === 'fallback'">
          Texto gerado a partir das regras, sem uso de IA nesta versão.
        </template>
        Regras versão {{ resultado.algoritmo }}.
      </p>
    </template>
  </div>
</template>
