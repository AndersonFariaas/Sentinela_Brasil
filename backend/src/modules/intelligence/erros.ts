/**
 * Erro de coleta com mensagem segura para registrar no banco e no log.
 * Nunca carrega corpo de resposta, cabeçalho ou chave.
 */
export class ErroColeta extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroColeta';
  }
}
