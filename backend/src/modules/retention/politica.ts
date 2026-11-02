const MS_POR_DIA = 24 * 60 * 60 * 1000;

export interface RegraRetencao {
  tabela: 'scans' | 'alerts' | 'ingestion_runs' | 'audit_log';
  /** Coluna que marca a data de criação do registro. */
  colunaData: 'created_at' | 'started_at';
  diasRetencao: number;
}

/**
 * Prazos de database.md §6. Análises (analyses) e vínculos de alerta são apagados em cascata
 * com o registro pai. Ameaças e indicadores não entram aqui: são a base de inteligência e
 * continuam enquanto a fonte estiver ativa.
 */
export const REGRAS_RETENCAO: readonly RegraRetencao[] = [
  { tabela: 'scans', colunaData: 'created_at', diasRetencao: 180 },
  { tabela: 'alerts', colunaData: 'created_at', diasRetencao: 180 },
  { tabela: 'ingestion_runs', colunaData: 'started_at', diasRetencao: 90 },
  { tabela: 'audit_log', colunaData: 'created_at', diasRetencao: 365 },
];

/** Registros anteriores a este instante passam do prazo. */
export function limiteDeRetencao(agora: Date, diasRetencao: number): Date {
  return new Date(agora.getTime() - diasRetencao * MS_POR_DIA);
}
