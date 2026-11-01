import type { Env } from '../../config/env.js';
import type {
  AmeacaDetalhe,
  AmeacaResumo,
  FiltrosAmeacas,
  FiltrosIndicadores,
  IndicadorResumo,
  LeitorAmeacas,
} from '../../modules/threats/leitor.js';
import type {
  CategoriaAmeaca,
  Severidade,
  TipoIndicador,
} from '../../modules/intelligence/tipos.js';
import { criarClienteDoUsuario } from './clientes.js';

type ConfigSupabase = Pick<Env, 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'>;

const COLUNAS_AMEACA = `
  id, title, description, category, severity, verification_status,
  cve_id, source_url, published_at, collected_at, last_verified_at,
  sources(name)
`;

const COLUNAS_INDICADOR =
  'id, indicator_type, indicator_value, confidence, first_seen_at, last_seen_at';

interface LinhaAmeaca {
  id: string;
  title: string;
  description: string | null;
  category: CategoriaAmeaca;
  severity: Severidade;
  verification_status: string;
  cve_id: string | null;
  source_url: string | null;
  published_at: string | null;
  collected_at: string;
  last_verified_at: string | null;
  sources: { name: string } | null;
}

interface LinhaIndicador {
  id: string;
  indicator_type: TipoIndicador;
  indicator_value: string;
  confidence: number;
  first_seen_at: string;
  last_seen_at: string;
}

function garantirSemErro(erro: { message: string } | null, contexto: string): void {
  if (erro) {
    throw new Error(`${contexto}: ${erro.message}`);
  }
}

function paraAmeaca(linha: LinhaAmeaca): AmeacaResumo {
  return {
    id: linha.id,
    titulo: linha.title,
    descricao: linha.description,
    categoria: linha.category,
    severidade: linha.severity,
    estadoVerificacao: linha.verification_status,
    cveId: linha.cve_id,
    urlFonte: linha.source_url,
    fonte: linha.sources ? { nome: linha.sources.name } : null,
    publicadoEm: linha.published_at,
    coletadoEm: linha.collected_at,
    ultimaVerificacao: linha.last_verified_at,
  };
}

function paraIndicador(linha: LinhaIndicador): IndicadorResumo {
  return {
    id: linha.id,
    tipo: linha.indicator_type,
    valor: linha.indicator_value,
    confianca: linha.confidence,
    primeiraVez: linha.first_seen_at,
    ultimaVez: linha.last_seen_at,
  };
}

/**
 * Leitura do Threat Feed com o JWT do usuário: a RLS do banco decide o que ele vê.
 * Paginação por deslocamento. Adequada ao volume atual; trocar por cursor se o feed crescer muito.
 */
export function criarLeitorAmeacasSupabase(config: ConfigSupabase): LeitorAmeacas {
  return {
    async listarAmeacas(accessToken, filtros: FiltrosAmeacas) {
      const cliente = criarClienteDoUsuario(config, accessToken);
      let consulta = cliente.from('threats').select(COLUNAS_AMEACA);

      if (filtros.categoria) {
        consulta = consulta.eq('category', filtros.categoria);
      }
      if (filtros.severidade) {
        consulta = consulta.eq('severity', filtros.severidade);
      }

      const inicio = filtros.pagina * filtros.limite;
      const { data, error } = await consulta
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: true })
        .range(inicio, inicio + filtros.limite - 1);
      garantirSemErro(error, 'Falha ao listar ameaças');

      return (data ?? []).map((linha) => paraAmeaca(linha as unknown as LinhaAmeaca));
    },

    async buscarAmeaca(accessToken, id): Promise<AmeacaDetalhe | null> {
      const cliente = criarClienteDoUsuario(config, accessToken);

      const { data, error } = await cliente
        .from('threats')
        .select(COLUNAS_AMEACA)
        .eq('id', id)
        .maybeSingle();
      garantirSemErro(error, 'Falha ao buscar ameaça');

      if (!data) {
        return null;
      }

      const { data: vinculos, error: erroVinculos } = await cliente
        .from('threat_indicators')
        .select(`indicators(${COLUNAS_INDICADOR})`)
        .eq('threat_id', id);
      garantirSemErro(erroVinculos, 'Falha ao buscar indicadores da ameaça');

      // O join pode voltar vazio se a linha de indicador não estiver visível; ignoramos esse caso.
      const indicadores = (vinculos ?? []).flatMap((vinculo) => {
        const indicador = vinculo.indicators as unknown as LinhaIndicador | null;
        return indicador ? [paraIndicador(indicador)] : [];
      });

      return { ...paraAmeaca(data as unknown as LinhaAmeaca), indicadores };
    },

    async listarIndicadores(accessToken, filtros: FiltrosIndicadores) {
      const cliente = criarClienteDoUsuario(config, accessToken);
      let consulta = cliente.from('indicators').select(COLUNAS_INDICADOR);

      if (filtros.tipo) {
        consulta = consulta.eq('indicator_type', filtros.tipo);
      }

      const inicio = filtros.pagina * filtros.limite;
      const { data, error } = await consulta
        .order('last_seen_at', { ascending: false })
        .order('id', { ascending: true })
        .range(inicio, inicio + filtros.limite - 1);
      garantirSemErro(error, 'Falha ao listar indicadores');

      return (data ?? []).map((linha) => paraIndicador(linha as unknown as LinhaIndicador));
    },

    async buscarIndicador(accessToken, id) {
      const cliente = criarClienteDoUsuario(config, accessToken);

      const { data, error } = await cliente
        .from('indicators')
        .select(COLUNAS_INDICADOR)
        .eq('id', id)
        .maybeSingle();
      garantirSemErro(error, 'Falha ao buscar indicador');

      return data ? paraIndicador(data as unknown as LinhaIndicador) : null;
    },
  };
}
