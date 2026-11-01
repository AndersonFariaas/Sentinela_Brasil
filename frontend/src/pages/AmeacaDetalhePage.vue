<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import CabecalhoPagina from '@/components/CabecalhoPagina.vue';
import EstadoCarregando from '@/components/EstadoCarregando.vue';
import EstadoErro from '@/components/EstadoErro.vue';
import EstadoVazio from '@/components/EstadoVazio.vue';
import SeveridadeBadge from '@/components/SeveridadeBadge.vue';
import { ROTULOS_CATEGORIA, ROTULOS_ESTADO_VERIFICACAO, formatarData } from '@/constantes/ameacas';
import { ErroApi } from '@/services/api';
import { buscarAmeaca, type DetalheAmeaca } from '@/services/ameacas';
import { useSessaoStore } from '@/stores/sessao';

const rota = useRoute();
const sessao = useSessaoStore();

const identificador = computed(() => String(rota.params.id));
const detalhe = ref<DetalheAmeaca | null>(null);
const carregando = ref(true);
const naoEncontrada = ref(false);
const erro = ref<string | null>(null);

// Só links https são exibidos: a origem vem de fontes externas e não é confiável por padrão.
const linkFonteSeguro = computed(() =>
  detalhe.value?.urlFonte?.startsWith('https://') ? detalhe.value.urlFonte : null,
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
  naoEncontrada.value = false;

  try {
    detalhe.value = await buscarAmeaca(token, identificador.value);
  } catch (falha) {
    if (falha instanceof ErroApi && falha.status === 404) {
      naoEncontrada.value = true;
    } else if (falha instanceof ErroApi && falha.status === 401) {
      erro.value = 'Sua sessão expirou. Entre novamente.';
    } else {
      console.error('Falha ao carregar o detalhe da ameaça', falha);
      erro.value = 'Não foi possível carregar os detalhes. Tente novamente.';
    }
  } finally {
    carregando.value = false;
  }
}

onMounted(() => void carregar());
</script>

<template>
  <div class="space-y-6">
    <RouterLink :to="{ name: 'ameacas' }" class="link">← Voltar ao feed</RouterLink>

    <EstadoCarregando v-if="carregando" texto="Carregando detalhes…" />

    <EstadoVazio
      v-else-if="naoEncontrada"
      titulo="Ameaça não encontrada"
      descricao="Ela pode ter sido removida ou o endereço está incorreto."
    />

    <div v-else-if="erro" class="space-y-3">
      <EstadoErro :mensagem="erro" />
      <button type="button" class="botao-secundario" @click="carregar">Tentar de novo</button>
    </div>

    <template v-else-if="detalhe">
      <CabecalhoPagina :titulo="detalhe.titulo" />

      <div class="flex flex-wrap items-center gap-2 text-sm text-texto-suave">
        <span>{{ ROTULOS_CATEGORIA[detalhe.categoria] }}</span>
        <span aria-hidden="true">·</span>
        <SeveridadeBadge :severidade="detalhe.severidade" />
        <span aria-hidden="true">·</span>
        <span>{{
          ROTULOS_ESTADO_VERIFICACAO[detalhe.estadoVerificacao] ?? detalhe.estadoVerificacao
        }}</span>
      </div>

      <section v-if="detalhe.descricao" class="cartao space-y-2" aria-labelledby="titulo-descricao">
        <h2 id="titulo-descricao" class="font-semibold">Descrição</h2>
        <p>{{ detalhe.descricao }}</p>
      </section>

      <section class="cartao" aria-labelledby="titulo-origem">
        <h2 id="titulo-origem" class="mb-3 font-semibold">Origem</h2>
        <dl class="grid gap-3 sm:grid-cols-2">
          <div>
            <dt class="text-sm text-texto-suave">Fonte</dt>
            <dd>{{ detalhe.fonte?.nome ?? 'não informada' }}</dd>
          </div>
          <div v-if="detalhe.cveId">
            <dt class="text-sm text-texto-suave">Identificador CVE</dt>
            <dd class="font-mono">{{ detalhe.cveId }}</dd>
          </div>
          <div>
            <dt class="text-sm text-texto-suave">Publicado em</dt>
            <dd>{{ formatarData(detalhe.publicadoEm) }}</dd>
          </div>
          <div>
            <dt class="text-sm text-texto-suave">Coletado em</dt>
            <dd>{{ formatarData(detalhe.coletadoEm) }}</dd>
          </div>
        </dl>
        <p v-if="linkFonteSeguro" class="mt-4">
          <a :href="linkFonteSeguro" target="_blank" rel="noopener noreferrer" class="link">
            Abrir fonte original
          </a>
        </p>
      </section>

      <section class="cartao" aria-labelledby="titulo-indicadores">
        <h2 id="titulo-indicadores" class="mb-3 font-semibold">Indicadores</h2>
        <p v-if="detalhe.indicadores.length === 0" class="text-texto-suave">
          Esta ameaça não tem indicadores associados.
        </p>
        <ul v-else class="space-y-2">
          <li
            v-for="indicador in detalhe.indicadores"
            :key="indicador.id"
            class="flex flex-wrap gap-2"
          >
            <span class="text-sm text-texto-suave">{{ indicador.tipo }}</span>
            <code class="break-all font-mono text-sm">{{ indicador.valor }}</code>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
