export interface MensagemEmail {
  para: string;
  assunto: string;
  html: string;
  texto: string;
  /** Link de um clique para cancelar a inscrição. Vai no corpo e no cabeçalho List-Unsubscribe. */
  cancelamentoUrl: string;
}

/**
 * Contrato de envio. A implementação com a Resend fica em integrations/resend.
 * Trocar de provedor exige só um novo adaptador.
 */
export interface ProvedorEmail {
  /**
   * Devolve o id da mensagem aceita pelo provedor. Repetir a chamada com a mesma
   * chave de idempotência não envia de novo.
   */
  enviar(mensagem: MensagemEmail, chaveIdempotencia: string): Promise<string>;
}

/** Falha de envio com mensagem segura para gravar no banco. Nunca carrega resposta bruta do provedor. */
export class ErroEnvioEmail extends Error {
  constructor(
    readonly temporario: boolean,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroEnvioEmail';
  }
}
