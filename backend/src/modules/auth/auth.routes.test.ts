import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import type { Env } from '../../config/env.js';
import {
  PERFIL_TESTE,
  TOKEN_VALIDO,
  criarAutenticadorFalso,
} from '../../../tests/helpers/autenticador-falso.js';
import { extrairTokenBearer } from './auth.guard.js';

const ENV_TESTE: Env = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: 3000,
  LOG_LEVEL: 'silent',
  CORS_ORIGIN: ['http://localhost:5173'],
  SUPABASE_URL: 'https://projeto.supabase.co',
  SUPABASE_ANON_KEY: 'chave-publica-de-teste',
};

describe('GET /api/v1/auth/me', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
    vi.restoreAllMocks();
  });

  async function iniciar(autenticador = criarAutenticadorFalso()): Promise<FastifyInstance> {
    app = await buildApp(ENV_TESTE, { autenticador });
    return app;
  }

  it('recusa a requisição sem cabeçalho Authorization', async () => {
    const servidor = await iniciar();

    const resposta = await servidor.inject({ method: 'GET', url: '/api/v1/auth/me' });

    expect(resposta.statusCode).toBe(401);
    expect(resposta.json()).toEqual({
      error: { code: 'NAO_AUTENTICADO', message: 'Autenticação necessária.' },
    });
  });

  it('recusa token que o Auth não aceita', async () => {
    const servidor = await iniciar();

    const resposta = await servidor.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: 'Bearer token-invalido' },
    });

    expect(resposta.statusCode).toBe(401);
  });

  it('recusa cabeçalho que não é Bearer', async () => {
    const servidor = await iniciar();

    const resposta = await servidor.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Basic ${TOKEN_VALIDO}` },
    });

    expect(resposta.statusCode).toBe(401);
  });

  it('retorna o perfil do usuário autenticado', async () => {
    const servidor = await iniciar();

    const resposta = await servidor.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${TOKEN_VALIDO}` },
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toEqual({
      id: PERFIL_TESTE.id,
      email: PERFIL_TESTE.email,
      fullName: PERFIL_TESTE.fullName,
      role: PERFIL_TESTE.role,
    });
  });

  it('não devolve o token na resposta', async () => {
    const servidor = await iniciar();

    const resposta = await servidor.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${TOKEN_VALIDO}` },
    });

    expect(resposta.body).not.toContain(TOKEN_VALIDO);
  });

  it('retorna 404 quando o usuário autenticado não tem perfil', async () => {
    const servidor = await iniciar(
      criarAutenticadorFalso({ buscarPerfil: () => Promise.resolve(null) }),
    );

    const resposta = await servidor.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${TOKEN_VALIDO}` },
    });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json()).toEqual({
      error: { code: 'PERFIL_NAO_ENCONTRADO', message: 'Perfil não encontrado.' },
    });
  });

  it('responde 500 genérico quando a consulta ao perfil falha', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const servidor = await iniciar(
      criarAutenticadorFalso({
        buscarPerfil: () => Promise.reject(new Error('detalhe interno que não deve vazar')),
      }),
    );

    const resposta = await servidor.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${TOKEN_VALIDO}` },
    });

    expect(resposta.statusCode).toBe(500);
    expect(resposta.body).not.toContain('detalhe interno');
  });
});

describe('extrairTokenBearer', () => {
  it('extrai o token de um cabeçalho Bearer válido', () => {
    expect(extrairTokenBearer('Bearer abc.def-ghi_123')).toBe('abc.def-ghi_123');
  });

  it.each([
    ['cabeçalho ausente', undefined],
    ['cabeçalho vazio', ''],
    ['sem token', 'Bearer'],
    ['token vazio', 'Bearer '],
    ['dois tokens', 'Bearer a b'],
    ['esquema diferente', 'Basic abc'],
    ['esquema em minúsculas', 'bearer abc'],
    ['caractere inválido', 'Bearer abc!'],
  ])('retorna null para %s', (_descricao, cabecalho) => {
    expect(extrairTokenBearer(cabecalho)).toBeNull();
  });
});
