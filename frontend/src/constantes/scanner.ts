// Espelha os valores de modules/scanner/tipos.ts do backend. Os rótulos ficam aqui, em português.
export const CLASSIFICACOES = ['confirmado', 'suspeito', 'nao_identificado'] as const;

export type Classificacao = (typeof CLASSIFICACOES)[number];

// "Não identificado" é o termo do produto. Nunca "seguro": a ausência de registro não prova legitimidade.
export const ROTULOS_CLASSIFICACAO: Record<Classificacao, string> = {
  confirmado: 'Confirmado',
  suspeito: 'Suspeito',
  nao_identificado: 'Não identificado',
};

export const ROTULOS_GRUPO_EVIDENCIA: Record<'R' | 'E', string> = {
  R: 'Reputação',
  E: 'Estrutura',
};
