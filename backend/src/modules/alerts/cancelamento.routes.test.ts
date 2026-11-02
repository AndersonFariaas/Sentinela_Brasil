import Fastify, { type FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { cancelamentoRoutes, type CancelarInscricao } from './cancelamento.routes.js';

const INSCRICAO = '33333333-3333-4333-8333-333333333333';

async function criarServidor(cancelar: Mock): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(rateLimit, { global: false });
  await app.register(cancelamentoRoutes, {
    prefix: '/api/v1',
    cancelar: cancelar as CancelarInscricao,
  });
  return app;
}

describe('cancelamento de alertas', () => {
  let app: FastifyInstance;
  let cancelar: Mock;

  beforeEach(async () => {
    cancelar = vi.fn().mockResolvedValue(undefined);
    app = await criarServidor(cancelar);
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET mostra a confirmação sem cancelar nada', async () => {
    const resposta = await app.inject({
      method: 'GET',
      url: `/api/v1/alertas/cancelar/${INSCRICAO}`,
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers['content-type']).toContain('text/html');
    expect(resposta.body).toContain(`action="/api/v1/alertas/cancelar/${INSCRICAO}"`);
    expect(cancelar).not.toHaveBeenCalled();
  });

  it('POST cancela a inscrição indicada e confirma ao usuário', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: `/api/v1/alertas/cancelar/${INSCRICAO}`,
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.body).toContain('Você não recebe mais alertas desta categoria.');
    expect(cancelar).toHaveBeenCalledWith(INSCRICAO);
  });

  it('aceita o POST de um clique enviado pelo cliente de e-mail (formulário)', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: `/api/v1/alertas/cancelar/${INSCRICAO}`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'List-Unsubscribe=One-Click',
    });

    expect(resposta.statusCode).toBe(200);
    expect(cancelar).toHaveBeenCalledWith(INSCRICAO);
  });

  it('id inválido responde 404 e não toca no banco', async () => {
    const get = await app.inject({ method: 'GET', url: '/api/v1/alertas/cancelar/nao-e-uuid' });
    const post = await app.inject({ method: 'POST', url: '/api/v1/alertas/cancelar/nao-e-uuid' });

    expect(get.statusCode).toBe(404);
    expect(post.statusCode).toBe(404);
    expect(cancelar).not.toHaveBeenCalled();
  });

  it('id válido que não existe recebe a mesma confirmação (sem revelar existência)', async () => {
    const inexistente = '44444444-4444-4444-8444-444444444444';
    const resposta = await app.inject({
      method: 'POST',
      url: `/api/v1/alertas/cancelar/${inexistente}`,
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.body).toContain('Você não recebe mais alertas desta categoria.');
  });

  it('falha no banco não vira confirmação falsa', async () => {
    cancelar.mockRejectedValue(new Error('banco fora do ar'));

    const resposta = await app.inject({
      method: 'POST',
      url: `/api/v1/alertas/cancelar/${INSCRICAO}`,
    });

    expect(resposta.statusCode).toBe(500);
    expect(resposta.body).not.toContain('Você não recebe mais alertas');
  });
});
