import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import type { Env } from '../../config/env.js';
import { TOKEN_VALIDO, criarAutenticadorFalso } from '../../../tests/helpers/autenticador-falso.js';
import type { RepositorioScans } from './repositorio.js';

const ENV_TESTE: Env = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: 3000,
  LOG_LEVEL: 'silent',
  CORS_ORIGIN: ['http://localhost:5173'],
  SUPABASE_URL: 'https://projeto.supabase.co',
  SUPABASE_ANON_KEY: 'chave-publica-de-teste',
};

const ID_ANALISE = '66666666-6666-4666-8666-666666666666';
const AUTENTICADO = { authorization: `Bearer ${TOKEN_VALIDO}` };

function repositorioFalso(sobrescrever: Partial<RepositorioScans> = {}): RepositorioScans {
  return {
    buscarCorrespondencias: vi.fn().mockResolvedValue([]),
    registrarAnalise: vi.fn().mockResolvedValue(ID_ANALISE),
    buscarAnalise: vi.fn().mockResolvedValue(null),
    listarAnalises: vi.fn().mockResolvedValue({ itens: [], temMais: false }),
    excluirAnalise: vi.fn().mockResolvedValue(false),
    ...sobrescrever,
  };
}

describe('histórico de análises', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  async function iniciar(repositorio: RepositorioScans): Promise<FastifyInstance> {
    app = await buildApp(ENV_TESTE, {
      autenticador: criarAutenticadorFalso(),
      repositorioScans: repositorio,
      provedorIa: null,
    });
    return app;
  }

  describe('GET /api/v1/scans', () => {
    it('devolve a página pedida e calcula o deslocamento a partir da página', async () => {
      const listarAnalises = vi.fn().mockResolvedValue({ itens: [], temMais: true });
      const servidor = await iniciar(repositorioFalso({ listarAnalises }));

      const resposta = await servidor.inject({
        method: 'GET',
        url: '/api/v1/scans?pagina=3&limite=10',
        headers: AUTENTICADO,
      });

      expect(resposta.statusCode).toBe(200);
      expect(listarAnalises).toHaveBeenCalledWith(TOKEN_VALIDO, { deslocamento: 20, limite: 10 });
      expect(resposta.json()).toEqual({ itens: [], pagina: 3, limite: 10, temMais: true });
    });

    it('usa página 1 e limite 20 quando não informados', async () => {
      const listarAnalises = vi.fn().mockResolvedValue({ itens: [], temMais: false });
      const servidor = await iniciar(repositorioFalso({ listarAnalises }));

      await servidor.inject({ method: 'GET', url: '/api/v1/scans', headers: AUTENTICADO });

      expect(listarAnalises).toHaveBeenCalledWith(TOKEN_VALIDO, { deslocamento: 0, limite: 20 });
    });

    it('recusa limite acima de 50 e página zero', async () => {
      const servidor = await iniciar(repositorioFalso());

      const limiteAlto = await servidor.inject({
        method: 'GET',
        url: '/api/v1/scans?limite=500',
        headers: AUTENTICADO,
      });
      const paginaZero = await servidor.inject({
        method: 'GET',
        url: '/api/v1/scans?pagina=0',
        headers: AUTENTICADO,
      });

      expect(limiteAlto.statusCode).toBe(400);
      expect(paginaZero.statusCode).toBe(400);
    });

    it('exige login', async () => {
      const servidor = await iniciar(repositorioFalso());

      const resposta = await servidor.inject({ method: 'GET', url: '/api/v1/scans' });

      expect(resposta.statusCode).toBe(401);
    });
  });

  describe('DELETE /api/v1/scans/:id', () => {
    const ID = '77777777-7777-4777-8777-777777777777';

    it('exclui com o token do usuário e responde 204', async () => {
      const excluirAnalise = vi.fn().mockResolvedValue(true);
      const servidor = await iniciar(repositorioFalso({ excluirAnalise }));

      const resposta = await servidor.inject({
        method: 'DELETE',
        url: `/api/v1/scans/${ID}`,
        headers: AUTENTICADO,
      });

      expect(resposta.statusCode).toBe(204);
      expect(excluirAnalise).toHaveBeenCalledWith(TOKEN_VALIDO, ID);
    });

    it('responde 404 quando o registro não existe ou não é do usuário', async () => {
      const servidor = await iniciar(
        repositorioFalso({ excluirAnalise: vi.fn().mockResolvedValue(false) }),
      );

      const resposta = await servidor.inject({
        method: 'DELETE',
        url: `/api/v1/scans/${ID}`,
        headers: AUTENTICADO,
      });

      expect(resposta.statusCode).toBe(404);
    });

    it('recusa identificador que não é UUID', async () => {
      const excluirAnalise = vi.fn();
      const servidor = await iniciar(repositorioFalso({ excluirAnalise }));

      const resposta = await servidor.inject({
        method: 'DELETE',
        url: '/api/v1/scans/nao-e-uuid',
        headers: AUTENTICADO,
      });

      expect(resposta.statusCode).toBe(400);
      expect(excluirAnalise).not.toHaveBeenCalled();
    });

    it('exige login', async () => {
      const servidor = await iniciar(repositorioFalso());

      const resposta = await servidor.inject({ method: 'DELETE', url: `/api/v1/scans/${ID}` });

      expect(resposta.statusCode).toBe(401);
    });
  });
});
