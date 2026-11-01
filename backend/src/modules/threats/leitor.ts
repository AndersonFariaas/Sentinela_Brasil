import type { CategoriaAmeaca, Severidade, TipoIndicador } from '../intelligence/tipos.js';

export interface FonteResumo {
  nome: string;
}

export interface IndicadorResumo {
  id: string;
  tipo: TipoIndicador;
  valor: string;
  confianca: number;
  primeiraVez: string;
  ultimaVez: string;
}

export interface AmeacaResumo {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: CategoriaAmeaca;
  severidade: Severidade;
  estadoVerificacao: string;
  cveId: string | null;
  urlFonte: string | null;
  fonte: FonteResumo | null;
  publicadoEm: string | null;
  coletadoEm: string;
  ultimaVerificacao: string | null;
}

export interface AmeacaDetalhe extends AmeacaResumo {
  indicadores: IndicadorResumo[];
}

export interface FiltrosAmeacas {
  categoria?: CategoriaAmeaca | undefined;
  severidade?: Severidade | undefined;
  /** Pede um item a mais que o limite, para saber se existe próxima página. */
  limite: number;
  pagina: number;
}

export interface FiltrosIndicadores {
  tipo?: TipoIndicador | undefined;
  limite: number;
  pagina: number;
}

/** Leitura do Threat Feed com o token do usuário. A RLS do banco decide o que aparece. */
export interface LeitorAmeacas {
  listarAmeacas(accessToken: string, filtros: FiltrosAmeacas): Promise<AmeacaResumo[]>;
  buscarAmeaca(accessToken: string, id: string): Promise<AmeacaDetalhe | null>;
  listarIndicadores(accessToken: string, filtros: FiltrosIndicadores): Promise<IndicadorResumo[]>;
  buscarIndicador(accessToken: string, id: string): Promise<IndicadorResumo | null>;
}
