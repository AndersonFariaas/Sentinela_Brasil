export const MOTIVOS_FALHA_PROVEDOR = ['tempo_esgotado', 'recusa', 'erro_provedor'] as const;

export type MotivoFalhaProvedor = (typeof MOTIVOS_FALHA_PROVEDOR)[number];

/** Falha ao chamar o provedor. A mensagem não carrega o conteúdo enviado nem a resposta. */
export class ErroProvedorIa extends Error {
  constructor(readonly motivo: MotivoFalhaProvedor) {
    super(`Falha do provedor de IA: ${motivo}`);
    this.name = 'ErroProvedorIa';
  }
}

export interface RequisicaoIa {
  sistema: string;
  usuario: string;
  signal: AbortSignal;
}

/**
 * Porta do analista. Qualquer provedor que devolva texto serve, e o resto do módulo não
 * conhece o SDK. Os testes usam uma versão falsa.
 */
export interface ProvedorIa {
  readonly nome: string;
  readonly modelo: string;
  gerarTexto(requisicao: RequisicaoIa): Promise<string>;
}
