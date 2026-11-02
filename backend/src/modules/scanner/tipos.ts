export const CLASSIFICACOES = ['confirmado', 'suspeito', 'nao_identificado'] as const;
export type Classificacao = (typeof CLASSIFICACOES)[number];

export const NIVEIS_RISCO = ['baixo', 'moderado', 'alto', 'critico'] as const;
export type NivelRisco = (typeof NIVEIS_RISCO)[number];

/** Tipos de indicador que a reputação consulta. Hashes e CVEs não se aplicam a URLs. */
export type TipoIndicadorReputacao = 'domain' | 'url' | 'ip';

/** Correspondência entre a URL analisada e um indicador de uma fonte ativa. */
export interface CorrespondenciaReputacao {
  tipo: TipoIndicadorReputacao;
  valor: string;
  fonte: string;
  confiabilidade: number;
  ultimaVez: Date;
}

/** Evidência verificável: diz de qual grupo veio, qual regra e quanto pesou. */
export interface Evidencia {
  grupo: 'R' | 'E';
  id: string;
  titulo: string;
  descricao: string;
  peso: number;
}

export interface FonteConsultada {
  nome: string;
  status: 'consultada';
  correspondencias: number;
}

export interface Explicacao {
  resumo: string;
  justificativa: string;
  recomendacoes: string[];
}

export interface ResultadoAnalise {
  classificacao: Classificacao;
  pontuacao: number;
  nivel: NivelRisco;
  evidencias: Evidencia[];
  fontes: FonteConsultada[];
  explicacao: Explicacao;
}
