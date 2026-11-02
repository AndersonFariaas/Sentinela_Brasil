import { limiteDeRetencao, REGRAS_RETENCAO, type RegraRetencao } from './politica.js';

export interface RepositorioRetencao {
  /** Quantos registros da regra já passaram do prazo. Não apaga nada. */
  contarAnteriores(regra: RegraRetencao, limite: Date): Promise<number>;
  /** Apaga os registros da regra anteriores ao limite e devolve quantos foram apagados. */
  removerAnteriores(regra: RegraRetencao, limite: Date): Promise<number>;
  /** Grava o resumo na auditoria. Só é chamado quando a limpeza foi executada. */
  registrarLimpeza(resumo: Record<string, number>): Promise<void>;
}

export interface ResumoLimpeza {
  executada: boolean;
  /** Quantidade por tabela: apagada, se executada, ou que seria apagada, se não. */
  porTabela: Record<string, number>;
}

/**
 * Aplica os prazos de retenção. Sem `executar`, só conta, para revisar antes de apagar.
 * Com `executar`, apaga e registra a limpeza em audit_log.
 */
export async function executarLimpeza(
  repositorio: RepositorioRetencao,
  agora: Date,
  executar: boolean,
  regras: readonly RegraRetencao[] = REGRAS_RETENCAO,
): Promise<ResumoLimpeza> {
  const porTabela: Record<string, number> = {};

  for (const regra of regras) {
    const limite = limiteDeRetencao(agora, regra.diasRetencao);
    porTabela[regra.tabela] = executar
      ? await repositorio.removerAnteriores(regra, limite)
      : await repositorio.contarAnteriores(regra, limite);
  }

  if (executar) {
    await repositorio.registrarLimpeza(porTabela);
  }

  return { executada: executar, porTabela };
}
