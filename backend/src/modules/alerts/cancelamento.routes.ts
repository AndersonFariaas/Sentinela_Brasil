import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';
import { escaparHtml } from './template.js';

/** Desativa a inscrição indicada. Não diz se ela existia: a resposta ao usuário é a mesma. */
export type CancelarInscricao = (inscricaoId: string) => Promise<void>;

interface OpcoesCancelamentoRoutes {
  cancelar: CancelarInscricao;
}

// Cancelar é barato e não é sensível, mas evita que alguém varra ids em volume.
const LIMITE_CANCELAMENTO = { max: 30, timeWindow: '1 minute' } as const;
const TIPO_HTML = 'text/html; charset=utf-8';

const parametrosSchema = z.object({ inscricaoId: z.uuid() });

function pagina(titulo: string, corpo: string): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${escaparHtml(titulo)} · SENTINELA</title>
  </head>
  <body style="margin:0;padding:24px 16px;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
    <main style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px;">
      <h1 style="margin:0 0 12px;font-size:20px;">${escaparHtml(titulo)}</h1>
      ${corpo}
    </main>
  </body>
</html>`;
}

function formulario(inscricaoId: string): string {
  return `<p style="margin:0 0 20px;font-size:15px;line-height:1.5;">Ao confirmar, você deixa de receber alertas desta categoria no SENTINELA.</p>
      <form method="post" action="/api/v1/alertas/cancelar/${escaparHtml(inscricaoId)}">
        <button type="submit" style="min-height:44px;padding:0 20px;background:#1a1a1a;color:#ffffff;border:0;border-radius:6px;font-size:15px;cursor:pointer;">Cancelar alertas</button>
      </form>`;
}

const PAGINA_LINK_INVALIDO = pagina(
  'Link inválido',
  '<p style="margin:0;font-size:15px;line-height:1.5;">Este link não é válido. Se você recebeu um e-mail do SENTINELA, use o link mais recente.</p>',
);

const PAGINA_CONFIRMACAO = pagina(
  'Alertas cancelados',
  '<p style="margin:0;font-size:15px;line-height:1.5;">Pronto. Você não recebe mais alertas desta categoria.</p>',
);

/**
 * Cancelamento de alertas. O GET só mostra a confirmação: leitores de e-mail costumam
 * abrir links sozinhos, e um GET que cancelasse desligaria alertas sem querer.
 * O POST cancela. Clientes de e-mail usam o mesmo POST no botão de cancelar (RFC 8058).
 */
export const cancelamentoRoutes: FastifyPluginCallback<OpcoesCancelamentoRoutes> = (
  app,
  opcoes,
  done,
) => {
  // Clientes de e-mail enviam o POST de um clique como formulário. O corpo não é usado.
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (_request, corpo, concluir) => {
      concluir(null, corpo);
    },
  );

  app.get(
    '/alertas/cancelar/:inscricaoId',
    { config: { rateLimit: LIMITE_CANCELAMENTO } },
    (request, reply) => {
      const parametros = parametrosSchema.safeParse(request.params);
      if (!parametros.success) {
        return reply.status(404).type(TIPO_HTML).send(PAGINA_LINK_INVALIDO);
      }

      return reply
        .type(TIPO_HTML)
        .send(pagina('Cancelar alertas', formulario(parametros.data.inscricaoId)));
    },
  );

  app.post(
    '/alertas/cancelar/:inscricaoId',
    { config: { rateLimit: LIMITE_CANCELAMENTO } },
    async (request, reply) => {
      const parametros = parametrosSchema.safeParse(request.params);
      if (!parametros.success) {
        return reply.status(404).type(TIPO_HTML).send(PAGINA_LINK_INVALIDO);
      }

      await opcoes.cancelar(parametros.data.inscricaoId);
      return reply.type(TIPO_HTML).send(PAGINA_CONFIRMACAO);
    },
  );

  done();
};
