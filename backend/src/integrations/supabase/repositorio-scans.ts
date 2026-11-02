import { z } from 'zod';
import type { Env } from '../../config/env.js';
import {
  CLASSIFICACOES,
  NIVEIS_RISCO,
  type CorrespondenciaReputacao,
} from '../../modules/scanner/tipos.js';
import type {
  AnaliseRegistrada,
  CandidatoReputacao,
  NovaAnalise,
  RepositorioScans,
} from '../../modules/scanner/repositorio.js';
import { criarClienteDoUsuario } from './clientes.js';

type ConfigSupabase = Pick<Env, 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'>;

// Valores lidos de colunas jsonb são validados na fronteira, como qualquer entrada externa.
const evidenciaSchema = z.object({
  grupo: z.enum(['R', 'E']),
  id: z.string(),
  titulo: z.string(),
  descricao: z.string(),
  peso: z.number(),
});

const fonteSchema = z.object({
  nome: z.string(),
  status: z.literal('consultada'),
  correspondencias: z.number().int().nonnegative(),
});

const explicacaoSchema = z.object({
  resumo: z.string(),
  justificativa: z.string(),
  recomendacoes: z.array(z.string()),
});

const linhaIndicadorSchema = z.object({
  indicator_type: z.enum(['url', 'domain', 'ip']),
  indicator_value: z.string(),
  last_seen_at: z.string(),
  sources: z.object({ name: z.string(), reliability: z.number().int().min(1).max(5) }),
});

const linhaScanSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  host: z.string(),
  classification: z.enum(CLASSIFICACOES),
  risk_score: z.number().int().min(0).max(100),
  risk_level: z.enum(NIVEIS_RISCO),
  evidence: z.array(evidenciaSchema),
  sources_consulted: z.array(fonteSchema),
  algorithm_version: z.string(),
  created_at: z.string(),
  analyses: z.array(z.object({ ai_status: z.string(), content: explicacaoSchema })).min(1),
});

function garantirSemErro(erro: { message: string } | null, contexto: string): void {
  if (erro) {
    throw new Error(`${contexto}: ${erro.message}`);
  }
}

/** Só a combinação tipo + valor conta. Um domínio igual a uma URL não é correspondência. */
function chave(tipo: string, valor: string): string {
  return `${tipo}|${valor}`;
}

/**
 * Repositório do scanner sobre o Supabase. Leitura e gravação usam o token do usuário:
 * a RLS limita o que ele vê, e a função registrar_escaneamento grava só para auth.uid().
 */
export function criarRepositorioScansSupabase(config: ConfigSupabase): RepositorioScans {
  return {
    async buscarCorrespondencias(accessToken, candidatos: CandidatoReputacao[]) {
      if (candidatos.length === 0) {
        return [];
      }

      const cliente = criarClienteDoUsuario(config, accessToken);
      const { data, error } = await cliente
        .from('indicators')
        .select('indicator_type, indicator_value, last_seen_at, sources!inner(name, reliability)')
        .in(
          'indicator_value',
          candidatos.map((candidato) => candidato.valor),
        )
        .eq('sources.is_active', true);
      garantirSemErro(error, 'Falha ao consultar indicadores');

      const permitidos = new Set(candidatos.map(({ tipo, valor }) => chave(tipo, valor)));
      const linhas = z.array(linhaIndicadorSchema).parse(data ?? []);

      return linhas
        .filter((linha) => permitidos.has(chave(linha.indicator_type, linha.indicator_value)))
        .map((linha): CorrespondenciaReputacao => ({
          tipo: linha.indicator_type,
          valor: linha.indicator_value,
          fonte: linha.sources.name,
          confiabilidade: linha.sources.reliability,
          ultimaVez: new Date(linha.last_seen_at),
        }));
    },

    async registrarAnalise(accessToken, analise: NovaAnalise) {
      const cliente = criarClienteDoUsuario(config, accessToken);
      const { data, error } = await cliente.rpc('registrar_escaneamento', {
        p_url: analise.url,
        p_normalized_url: analise.normalizedUrl,
        p_host: analise.host,
        p_classification: analise.classificacao,
        p_risk_score: analise.pontuacao,
        p_risk_level: analise.nivel,
        p_rules_triggered: analise.evidencias.map(({ id, grupo, peso }) => ({ id, grupo, peso })),
        p_evidence: analise.evidencias.map((evidencia) => ({ ...evidencia })),
        p_sources_consulted: analise.fontes.map((fonte) => ({ ...fonte })),
        p_algorithm_version: analise.versaoAlgoritmo,
        p_ai_status: 'fallback',
        p_provider: 'deterministico',
        p_model: null,
        p_prompt_version: 'fallback-1',
        p_analysis_content: { ...analise.explicacao },
      });
      garantirSemErro(error, 'Falha ao registrar o escaneamento');

      return z.uuid().parse(data);
    },

    async buscarAnalise(accessToken, id) {
      const cliente = criarClienteDoUsuario(config, accessToken);
      const { data, error } = await cliente
        .from('scans')
        .select(
          'id, url, host, classification, risk_score, risk_level, evidence, sources_consulted, algorithm_version, created_at, analyses(ai_status, content)',
        )
        .eq('id', id)
        .maybeSingle();
      garantirSemErro(error, 'Falha ao buscar o escaneamento');

      if (!data) {
        return null;
      }

      const linha = linhaScanSchema.parse(data);
      const analise = linha.analyses[0];
      if (!analise) {
        // Escaneamento sem análise quebra a regra de gravação em uma única transação.
        throw new Error(`Escaneamento ${linha.id} sem análise registrada`);
      }

      const resultado: AnaliseRegistrada = {
        id: linha.id,
        url: linha.url,
        host: linha.host,
        classificacao: linha.classification,
        pontuacao: linha.risk_score,
        nivel: linha.risk_level,
        criadaEm: linha.created_at,
        evidencias: linha.evidence,
        fontes: linha.sources_consulted,
        versaoAlgoritmo: linha.algorithm_version,
        statusIa: analise.ai_status,
        explicacao: analise.content,
      };

      return resultado;
    },
  };
}
