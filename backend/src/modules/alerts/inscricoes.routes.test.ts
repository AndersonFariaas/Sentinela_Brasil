import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import type { Env } from '../../config/env.js';
import {
  TOKEN_VALIDO,
  USUARIO_TESTE,
  criarAutenticadorFalso,
} from '../../../tests/helpers/autenticador-falso.js';
import { CATEGORIAS_AMEACA } from '../intelligence/tipos.js';
import type { RepositorioInscricoes } from './inscricoes.js';

const ENV_TESTE: Env = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: 3000,
  LOG_LEVEL: 'silent',
  CORS_ORIGIN: ['http://localhost:5173'],
  SUPABASE_URL: 'https://projeto.supabase.co',
  SUPABASE_ANON_KEY: 'chave-publica-de-teste',
};

const AUTENTICADO = { authorization: `Bearer ${TOKEN_VALIDO}` };

function repositorioFalso(
  sobrescrever: Partial<RepositorioInscricoes> = {},
): RepositorioInscricoes {
  return {
    listar: vi.fn().mockResolvedValue([]),
    definir: vi.fn().mockResolvedValue(undefined),
    ...sobrescrever,
  };
}

describe('inscrições em alertas', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  async function iniciar(repositorio: RepositorioInscricoes): Promise<FastifyInstance> {
    app = await buildApp(ENV_TESTE, {
      autenticador: criarAutenticadorFalso(),
      repositorioInscricoes: repositorio,
      provedorIa: null,
    });
    return app;
  }

  describe('GET /api/v1/alertas/inscricoes', () => {
    it('lista todas as categorias, marcando como inativas as que não têm registro', async () => {
      const servidor = await iniciar(
        repositorioFalso({
          listar: vi.fn().mockResolvedValue([{ categoria: 'phishing', ativa: true }]),
        }),
      );

      const resposta = await servidor.inject({
        method: 'GET',
        url: '/api/v1/alertas/inscricoes',
        headers: AUTENTICADO,
      });
      const { inscricoes } = resposta.json<{
        inscricoes: { categoria: string; ativa: boolean }[];
      }>();

      expect(resposta.statusCode).toBe(200);
      expect(inscricoes).toHaveLength(CATEGORIAS_AMEACA.length);
      expect(inscricoes.find((item) => item.categoria === 'phishing')?.ativa).toBe(true);
      expect(inscricoes.find((item) => item.categoria === 'malware')?.ativa).toBe(false);
    });

    it('exige login', async () => {
      const servidor = await iniciar(repositorioFalso());

      const resposta = await servidor.inject({ method: 'GET', url: '/api/v1/alertas/inscricoes' });

      expect(resposta.statusCode).toBe(401);
    });
  });

  describe('PUT /api/v1/alertas/inscricoes/:categoria', () => {
    it('grava com o id do usuário autenticado e devolve a inscrição', async () => {
      const definir = vi.fn().mockResolvedValue(undefined);
      const servidor = await iniciar(repositorioFalso({ definir }));

      const resposta = await servidor.inject({
        method: 'PUT',
        url: '/api/v1/alertas/inscricoes/phishing',
        headers: AUTENTICADO,
        payload: { ativa: true },
      });

      expect(resposta.statusCode).toBe(200);
      expect(resposta.json()).toEqual({ categoria: 'phishing', ativa: true });
      expect(definir).toHaveBeenCalledWith(TOKEN_VALIDO, USUARIO_TESTE.id, 'phishing', true);
    });

    it('recusa categoria desconhecida sem gravar', async () => {
      const definir = vi.fn();
      const servidor = await iniciar(repositorioFalso({ definir }));

      const resposta = await servidor.inject({
        method: 'PUT',
        url: '/api/v1/alertas/inscricoes/inventada',
        headers: AUTENTICADO,
        payload: { ativa: true },
      });

      expect(resposta.statusCode).toBe(400);
      expect(definir).not.toHaveBeenCalled();
    });

    it('recusa corpo com "ativa" que não é booleano ou com campo extra', async () => {
      const definir = vi.fn();
      const servidor = await iniciar(repositorioFalso({ definir }));

      const textoNoLugarDeBooleano = await servidor.inject({
        method: 'PUT',
        url: '/api/v1/alertas/inscricoes/phishing',
        headers: AUTENTICADO,
        payload: { ativa: 'sim' },
      });
      const campoExtra = await servidor.inject({
        method: 'PUT',
        url: '/api/v1/alertas/inscricoes/phishing',
        headers: AUTENTICADO,
        payload: { ativa: true, usuario_id: 'outro-usuario' },
      });

      expect(textoNoLugarDeBooleano.statusCode).toBe(400);
      expect(campoExtra.statusCode).toBe(400);
      expect(definir).not.toHaveBeenCalled();
    });

    it('exige login', async () => {
      const servidor = await iniciar(repositorioFalso());

      const resposta = await servidor.inject({
        method: 'PUT',
        url: '/api/v1/alertas/inscricoes/phishing',
        payload: { ativa: true },
      });

      expect(resposta.statusCode).toBe(401);
    });
  });
});
