import { Writable } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import type { Env } from './config/env.js';
import { criarAutenticadorFalso } from '../tests/helpers/autenticador-falso.js';

const ENV_TESTE: Env = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: 3000,
  LOG_LEVEL: 'info',
  CORS_ORIGIN: ['http://localhost:5173'],
  SUPABASE_URL: 'https://projeto.supabase.co',
  SUPABASE_ANON_KEY: 'chave-publica-de-teste',
};

describe('API', () => {
  let app: FastifyInstance;
  let saidaDoLog: string;

  beforeEach(async () => {
    saidaDoLog = '';
    const logStream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        saidaDoLog += chunk.toString();
        callback();
      },
    });
    app = await buildApp(ENV_TESTE, { logStream, autenticador: criarAutenticadorFalso() });
  });

  afterEach(async () => {
    await app.close();
  });

  it('responde 200 em GET /api/v1/health', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({ status: 'ok' });
  });

  it('retorna erro padronizado para rota inexistente', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/v1/nao-existe' });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' },
    });
  });

  it('libera apenas a origem configurada no CORS', async () => {
    const permitida = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { origin: 'http://localhost:5173' },
    });
    const bloqueada = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { origin: 'https://site-malicioso.example' },
    });

    expect(permitida.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(bloqueada.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('envia cabeçalhos de segurança do helmet', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(resposta.headers['x-content-type-options']).toBe('nosniff');
  });

  it('redige segredos antes de gravar no log', async () => {
    const segredo = 'segredo-de-teste-123';
    app.get('/teste-de-log', (request) => {
      request.log.info(
        { headers: { authorization: `Bearer ${segredo}` }, serviceRole: segredo },
        'evento de teste',
      );
      return { ok: true };
    });

    await app.inject({ method: 'GET', url: '/teste-de-log' });

    expect(saidaDoLog).toContain('evento de teste');
    expect(saidaDoLog).toContain('[REDATADO]');
    expect(saidaDoLog).not.toContain(segredo);
  });
});
