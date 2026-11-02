import type {
  EstatisticasGravacao,
  RepositorioIngestao,
  ResultadoExecucao,
} from '../../modules/intelligence/ingestao.service.js';
import type { AmeacaColetada, IndicadorColetado } from '../../modules/intelligence/tipos.js';
import { normalizarIndicador } from '../../modules/intelligence/normalizacao.js';
import type { ClienteSupabase } from './clientes.js';
import type { Database } from './database.types.js';

const TAMANHO_BLOCO_LEITURA = 200;
const TAMANHO_BLOCO_GRAVACAO = 500;
const TAMANHO_MAXIMO_RESUMO_ERRO = 500;

type Ameaca = Database['public']['Tables']['threats']['Row'];
type AmeacaInsercao = Database['public']['Tables']['threats']['Insert'];

type CampoAcompanhado =
  'title' | 'description' | 'category' | 'severity' | 'cve_id' | 'source_url' | 'published_at';
const CAMPOS_ACOMPANHADOS: readonly CampoAcompanhado[] = [
  'title',
  'description',
  'category',
  'severity',
  'cve_id',
  'source_url',
  'published_at',
];

type Revisao = {
  threat_id: string;
  changed_fields: { [campo: string]: { antes: string | null; depois: string | null } };
  ingestion_run_id: string;
};

function emBlocos<T>(itens: readonly T[], tamanho: number): T[][] {
  const blocos: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    blocos.push(itens.slice(i, i + tamanho));
  }
  return blocos;
}

function garantirSemErro(erro: { message: string } | null, contexto: string): void {
  if (erro) {
    throw new Error(`${contexto}: ${erro.message}`);
  }
}

function chaveDeDuplicacao(fonteId: string, idExterno: string): string {
  return `${fonteId}:${idExterno}`;
}

/** Datas chegam do banco com +00:00; a coleta usa Z. Comparar como instante evita revisões falsas. */
function valorNormalizado(campo: CampoAcompanhado, valor: string | null): string | null {
  if (campo === 'published_at' && valor !== null) {
    return new Date(valor).toISOString();
  }
  return valor;
}

function montarLinha(ameaca: AmeacaColetada, fonteId: string, agora: string): AmeacaInsercao {
  return {
    dedupe_key: chaveDeDuplicacao(fonteId, ameaca.idExterno),
    external_id: ameaca.idExterno,
    title: ameaca.titulo,
    description: ameaca.descricao,
    category: ameaca.categoria,
    severity: ameaca.severidade,
    cve_id: ameaca.cveId,
    source_id: fonteId,
    source_url: ameaca.urlFonte,
    published_at: ameaca.publicadoEm,
    last_verified_at: agora,
    // Ausência do campo não altera o status já gravado, para não desfazer curadoria manual.
    ...(ameaca.verificada ? { verification_status: 'verificada' } : {}),
  };
}

function camposAlterados(
  antiga: Pick<Ameaca, CampoAcompanhado>,
  nova: AmeacaInsercao,
): Revisao['changed_fields'] {
  const alterados: Revisao['changed_fields'] = {};

  for (const campo of CAMPOS_ACOMPANHADOS) {
    const antes = valorNormalizado(campo, antiga[campo]);
    const depois = valorNormalizado(campo, nova[campo] ?? null);

    if (antes !== depois) {
      alterados[campo] = { antes, depois };
    }
  }

  return alterados;
}

export function criarRepositorioIngestao(cliente: ClienteSupabase): RepositorioIngestao {
  async function buscarExistentes(
    chaves: string[],
  ): Promise<Map<string, Pick<Ameaca, 'id' | CampoAcompanhado>>> {
    const existentes = new Map<string, Pick<Ameaca, 'id' | CampoAcompanhado>>();

    for (const bloco of emBlocos(chaves, TAMANHO_BLOCO_LEITURA)) {
      const { data, error } = await cliente
        .from('threats')
        .select(
          'id, dedupe_key, title, description, category, severity, cve_id, source_url, published_at',
        )
        .in('dedupe_key', bloco);
      garantirSemErro(error, 'Falha ao ler ameaças existentes');

      for (const linha of data ?? []) {
        existentes.set(linha.dedupe_key, linha);
      }
    }

    return existentes;
  }

  async function upsertAmeacas(linhas: AmeacaInsercao[]): Promise<Map<string, string>> {
    const ids = new Map<string, string>();

    for (const bloco of emBlocos(linhas, TAMANHO_BLOCO_GRAVACAO)) {
      const { data, error } = await cliente
        .from('threats')
        .upsert(bloco, { onConflict: 'dedupe_key' })
        .select('id, dedupe_key');
      garantirSemErro(error, 'Falha ao gravar ameaças');

      for (const linha of data ?? []) {
        ids.set(linha.dedupe_key, linha.id);
      }
    }

    return ids;
  }

  async function gravarRevisoes(revisoes: Revisao[]): Promise<void> {
    for (const bloco of emBlocos(revisoes, TAMANHO_BLOCO_GRAVACAO)) {
      const { error } = await cliente
        .from('threat_revisions')
        .insert(bloco.map((revisao) => ({ ...revisao, changed_fields: revisao.changed_fields })));
      garantirSemErro(error, 'Falha ao gravar histórico de alterações');
    }
  }

  /** Devolve id por "tipo|valor" para os indicadores pedidos. Filtra por tipo também, porque um valor pode existir com tipos diferentes. */
  async function buscarIdsIndicadores(
    pedidos: Map<string, { tipo: IndicadorColetado['tipo']; valor: string }>,
  ): Promise<Map<string, string>> {
    const ids = new Map<string, string>();
    const valores = [...new Set([...pedidos.values()].map((indicador) => indicador.valor))];

    for (const bloco of emBlocos(valores, TAMANHO_BLOCO_LEITURA)) {
      const { data, error } = await cliente
        .from('indicators')
        .select('id, indicator_type, indicator_value')
        .in('indicator_value', bloco);
      garantirSemErro(error, 'Falha ao ler indicadores');

      for (const linha of data ?? []) {
        const chave = `${linha.indicator_type}|${linha.indicator_value}`;
        if (pedidos.has(chave)) {
          ids.set(chave, linha.id);
        }
      }
    }

    return ids;
  }

  async function vincularIndicadores(
    ameacas: AmeacaColetada[],
    idsAmeacas: Map<string, string>,
    fonteId: string,
    agora: string,
  ): Promise<void> {
    const indicadoresUnicos = new Map<string, { tipo: IndicadorColetado['tipo']; valor: string }>();
    const pares = new Map<string, { threatId: string; chave: string }>();

    for (const ameaca of ameacas) {
      const threatId = idsAmeacas.get(chaveDeDuplicacao(fonteId, ameaca.idExterno));
      if (!threatId) {
        continue;
      }

      for (const indicador of ameaca.indicadores) {
        const valor = normalizarIndicador(indicador.tipo, indicador.valor);
        if (valor === null) {
          continue;
        }

        const chave = `${indicador.tipo}|${valor}`;
        indicadoresUnicos.set(chave, { tipo: indicador.tipo, valor });
        pares.set(`${threatId}|${chave}`, { threatId, chave });
      }
    }

    if (indicadoresUnicos.size === 0) {
      return;
    }

    const entradas = [...indicadoresUnicos.entries()];

    // 1) Cria só os indicadores novos. Os existentes são ignorados, então first_seen_at nunca é reescrito.
    // Como first_seen_at e last_seen_at são iguais na criação, a regra do banco é respeitada.
    for (const bloco of emBlocos(entradas, TAMANHO_BLOCO_GRAVACAO)) {
      const { error } = await cliente.from('indicators').upsert(
        bloco.map(([, indicador]) => ({
          indicator_type: indicador.tipo,
          indicator_value: indicador.valor,
          source_id: fonteId,
          first_seen_at: agora,
          last_seen_at: agora,
        })),
        { onConflict: 'indicator_type,indicator_value', ignoreDuplicates: true },
      );
      garantirSemErro(error, 'Falha ao gravar indicadores');
    }

    // 2) Lê o id de cada indicador usado nesta execução, novo ou já existente.
    const idsIndicadores = await buscarIdsIndicadores(indicadoresUnicos);

    // 3) Marca os indicadores como vistos agora, sem mexer em first_seen_at.
    const idsParaMarcar = [...idsIndicadores.values()];
    for (const bloco of emBlocos(idsParaMarcar, TAMANHO_BLOCO_GRAVACAO)) {
      const { error } = await cliente
        .from('indicators')
        .update({ last_seen_at: agora })
        .in('id', bloco);
      garantirSemErro(error, 'Falha ao atualizar indicadores vistos');
    }

    const vinculos = [...pares.values()].flatMap(({ threatId, chave }) => {
      const indicatorId = idsIndicadores.get(chave);
      return indicatorId ? [{ threat_id: threatId, indicator_id: indicatorId }] : [];
    });

    for (const bloco of emBlocos(vinculos, TAMANHO_BLOCO_GRAVACAO)) {
      const { error } = await cliente
        .from('threat_indicators')
        .upsert(bloco, { onConflict: 'threat_id,indicator_id', ignoreDuplicates: true });
      garantirSemErro(error, 'Falha ao vincular indicadores');
    }
  }

  return {
    async listarFontesAtivas() {
      const { data, error } = await cliente
        .from('sources')
        .select('id, name, source_type, base_url, reliability')
        .eq('is_active', true);
      garantirSemErro(error, 'Falha ao listar fontes');

      return (data ?? []).map((fonte) => ({
        id: fonte.id,
        nome: fonte.name,
        tipo: fonte.source_type,
        urlBase: fonte.base_url,
        confiabilidade: fonte.reliability,
      }));
    },

    async iniciarExecucao(fonteId) {
      const { data, error } = await cliente
        .from('ingestion_runs')
        .insert({ source_id: fonteId, status: 'running' })
        .select('id')
        .single();
      garantirSemErro(error, 'Falha ao iniciar execução');

      if (!data) {
        throw new Error('Falha ao iniciar execução: resposta vazia.');
      }
      return data.id;
    },

    async salvarAmeacas(execucaoId, fonteId, ameacas): Promise<EstatisticasGravacao> {
      if (ameacas.length === 0) {
        return { novas: 0, atualizadas: 0 };
      }

      const agora = new Date().toISOString();
      const linhas = ameacas.map((ameaca) => montarLinha(ameaca, fonteId, agora));
      const existentes = await buscarExistentes(linhas.map((linha) => linha.dedupe_key));

      let novas = 0;
      let atualizadas = 0;
      const revisoes: Revisao[] = [];

      for (const linha of linhas) {
        const antiga = existentes.get(linha.dedupe_key);
        if (!antiga) {
          novas += 1;
          continue;
        }

        const alterados = camposAlterados(antiga, linha);
        if (Object.keys(alterados).length > 0) {
          atualizadas += 1;
          revisoes.push({
            threat_id: antiga.id,
            changed_fields: alterados,
            ingestion_run_id: execucaoId,
          });
        }
      }

      const idsAmeacas = await upsertAmeacas(linhas);
      await gravarRevisoes(revisoes);
      await vincularIndicadores(ameacas, idsAmeacas, fonteId, agora);

      return { novas, atualizadas };
    },

    async concluirExecucao(execucaoId, resultado: ResultadoExecucao) {
      const { error } = await cliente
        .from('ingestion_runs')
        .update({
          status: resultado.status,
          finished_at: new Date().toISOString(),
          items_received: resultado.recebidos,
          items_new: resultado.novas,
          items_updated: resultado.atualizadas,
          error_summary: resultado.erro?.slice(0, TAMANHO_MAXIMO_RESUMO_ERRO) ?? null,
        })
        .eq('id', execucaoId);
      garantirSemErro(error, 'Falha ao concluir execução');
    },

    async registrarSucesso(fonteId) {
      const { error } = await cliente
        .from('sources')
        .update({ consecutive_failures: 0, last_success_at: new Date().toISOString() })
        .eq('id', fonteId);
      garantirSemErro(error, 'Falha ao registrar sucesso da fonte');
    },

    async registrarFalha(fonteId, mensagem) {
      const { data, error: erroLeitura } = await cliente
        .from('sources')
        .select('consecutive_failures')
        .eq('id', fonteId)
        .single();
      garantirSemErro(erroLeitura, 'Falha ao ler fonte');

      if (!data) {
        throw new Error('Falha ao ler fonte: fonte não encontrada.');
      }

      const falhas = data.consecutive_failures + 1;
      const { error } = await cliente
        .from('sources')
        .update({
          consecutive_failures: falhas,
          last_error_at: new Date().toISOString(),
          last_error_summary: mensagem.slice(0, TAMANHO_MAXIMO_RESUMO_ERRO),
        })
        .eq('id', fonteId);
      garantirSemErro(error, 'Falha ao registrar erro da fonte');

      return falhas;
    },

    async desativarFonte(fonteId) {
      const { error } = await cliente
        .from('sources')
        .update({ is_active: false })
        .eq('id', fonteId);
      garantirSemErro(error, 'Falha ao desativar fonte');
    },
  };
}
