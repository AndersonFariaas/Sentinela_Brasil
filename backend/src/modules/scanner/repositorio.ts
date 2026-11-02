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

/** Como a explicação foi gerada. Fica gravada junto da análise, para auditoria. */
export interface RegistroAnaliseIa {
  status: 'ok' | 'fallback';
  provedor: string;
  modelo: string | null;
  versaoPrompt: string;
  evidenciasCitadas: string[];
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
  analiseIa: RegistroAnaliseIa;
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
  analiseIa: RegistroAnaliseIa;
  explicacao: Explicacao;
}

/** Linha do histórico. Traz só o resumo: a análise completa vem de GET /scans/:id. */
export interface ResumoAnalise {
  id: string;
  url: string;
  host: string;
  classificacao: Classificacao;
  pontuacao: number;
  nivel: NivelRisco;
  criadaEm: string;
}

export interface PaginaAnalises {
  itens: ResumoAnalise[];
  /** Há itens depois desta página. Calculado buscando um item a mais, sem contar o total. */
  temMais: boolean;
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
  listarAnalises(
    accessToken: string,
    pagina: { deslocamento: number; limite: number },
  ): Promise<PaginaAnalises>;
  /** Devolve false quando o registro não existe ou não é do usuário (a RLS filtra). */
  excluirAnalise(accessToken: string, id: string): Promise<boolean>;
}
