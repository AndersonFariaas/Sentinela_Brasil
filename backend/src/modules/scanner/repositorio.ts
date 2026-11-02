import type {
  Classificacao,
  CorrespondenciaReputacao,
  Evidencia,
  Explicacao,
  FonteConsultada,
  NivelRisco,
  TipoIndicadorReputacao,
} from './tipos.js';

export interface CandidatoReputacao {
  tipo: TipoIndicadorReputacao;
  valor: string;
}

export interface NovaAnalise {
  url: string;
  normalizedUrl: string;
  host: string;
  versaoAlgoritmo: string;
  classificacao: Classificacao;
  pontuacao: number;
  nivel: NivelRisco;
  evidencias: Evidencia[];
  fontes: FonteConsultada[];
  explicacao: Explicacao;
}

export interface AnaliseRegistrada {
  id: string;
  url: string;
  host: string;
  classificacao: Classificacao;
  pontuacao: number;
  nivel: NivelRisco;
  criadaEm: string;
  evidencias: Evidencia[];
  fontes: FonteConsultada[];
  versaoAlgoritmo: string;
  statusIa: string;
  explicacao: Explicacao;
}

/**
 * Porta de acesso aos dados do scanner. Todas as chamadas recebem o token do usuário,
 * então a RLS do banco continua valendo. Os testes usam uma versão em memória.
 */
export interface RepositorioScans {
  buscarCorrespondencias(
    accessToken: string,
    candidatos: CandidatoReputacao[],
  ): Promise<CorrespondenciaReputacao[]>;
  registrarAnalise(accessToken: string, analise: NovaAnalise): Promise<string>;
  buscarAnalise(accessToken: string, id: string): Promise<AnaliseRegistrada | null>;
}
