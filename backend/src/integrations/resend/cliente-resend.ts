import { Resend } from 'resend';
import {
  ErroEnvioEmail,
  type MensagemEmail,
  type ProvedorEmail,
} from '../../modules/alerts/envio.js';

export const REMETENTE_PADRAO = 'SENTINELA <onboarding@resend.dev>';

// Códigos da Resend que valem nova tentativa. Os demais são definitivos e não adianta insistir.
const CODIGOS_TEMPORARIOS = new Set([
  'rate_limit_exceeded',
  'internal_server_error',
  'application_error',
  'concurrent_idempotent_requests',
]);

// Mensagens próprias para o usuário. Nunca repassamos o texto bruto da Resend.
const MENSAGENS_POR_CODIGO: Record<string, string> = {
  invalid_api_key: 'Chave da Resend inválida.',
  missing_api_key: 'Chave da Resend não configurada.',
  restricted_api_key: 'Chave da Resend sem permissão para enviar.',
  invalid_access: 'Chave da Resend sem permissão para enviar.',
  invalid_from_address: 'Remetente recusado pela Resend. Confira ALERTA_REMETENTE e o domínio.',
  validation_error: 'Dados do e-mail recusados pela Resend.',
  missing_required_field: 'Dados do e-mail recusados pela Resend.',
  invalid_parameter: 'Dados do e-mail recusados pela Resend.',
  invalid_idempotency_key: 'Chave de idempotência recusada pela Resend.',
  invalid_idempotent_request: 'Chave de idempotência reutilizada com outro conteúdo.',
  daily_quota_exceeded: 'Cota diária de envio da Resend atingida.',
  monthly_quota_exceeded: 'Cota mensal de envio da Resend atingida.',
};

const MENSAGEM_PADRAO = 'Envio recusado pela Resend.';

interface ConfigResend {
  apiKey: string;
  remetente?: string | undefined;
}

/** Adaptador da Resend. Envia com a chave de idempotência, então reenviar não duplica o e-mail. */
export function criarProvedorEmailResend(config: ConfigResend): ProvedorEmail {
  const cliente = new Resend(config.apiKey);
  const remetente = config.remetente ?? REMETENTE_PADRAO;

  return {
    async enviar(mensagem: MensagemEmail, chaveIdempotencia: string): Promise<string> {
      let resposta;
      try {
        resposta = await cliente.emails.send(
          {
            from: remetente,
            to: mensagem.para,
            subject: mensagem.assunto,
            html: mensagem.html,
            text: mensagem.texto,
            // Cliente de e-mail mostra o botão de cancelar sem abrir o corpo da mensagem.
            headers: {
              'List-Unsubscribe': `<${mensagem.cancelamentoUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          },
          { idempotencyKey: chaveIdempotencia },
        );
      } catch {
        // Falha de rede ou de transporte: sempre transitória.
        throw new ErroEnvioEmail(true, 'Falha de rede ao falar com a Resend.');
      }

      if (resposta.error) {
        const codigo = resposta.error.name;
        throw new ErroEnvioEmail(
          CODIGOS_TEMPORARIOS.has(codigo),
          MENSAGENS_POR_CODIGO[codigo] ?? MENSAGEM_PADRAO,
        );
      }

      return resposta.data.id;
    },
  };
}
