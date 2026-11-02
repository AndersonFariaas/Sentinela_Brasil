import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import type { Env } from '../../config/env.js';
import { TOKEN_VALIDO, criarAutenticadorFalso } from '../../../tests/helpers/autenticador-falso.js';
import type { AnaliseRegistrada, RepositorioScans } from './repositorio.js';

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
    ...sobrescrever,
  };
}

function analiseGravada(): AnaliseRegistrada {
  return {
    id: ID_ANALISE,
    url: 'https://exemplo.com/login',
    host: 'exemplo.com',
    classificacao: 'nao_identificado',
    pontuacao: 10,
    nivel: 'baixo',
    criadaEm: '2026-11-01T12:00:00.000Z',
    evidencias: [],
    fontes: [{ nome: 'Indicadores coletados', status: 'consultada', correspondencias: 0 }],
    versaoAlgoritmo: '1.0.0',
    statusIa: 'fallback',
    explicacao: {
      resumo: 'Resumo de teste.',
      justificativa: 'Justificativa de teste.',
      recomendacoes: ['Recomendação de teste.'],
    },
  };
}

describe('rotas do scanner', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function iniciar(repositorio: RepositorioScans): Promise<FastifyInstance> {
    app = await buildApp(ENV_TESTE, {
      autenticador: criarAutenticadorFalso(),
      repositorioScans: repositorio,
    });
    return app;
  }

  describe('POST /api/v1/scans', () => {
    it('exige token', async () => {
      const servidor = await iniciar(repositorioFalso());

      const resposta = await servidor.inject({
        method: 'POST',
        url: '/api/v1/scans',
        payload: { url: 'https://exemplo.com/' },
      });

      expect(resposta.statusCode).toBe(401);
    });

    it('analisa a URL, registra o resultado e responde 201 com a análise', async () => {
      const registrarAnalise = vi.fn().mockResolvedValue(ID_ANALISE);
      const servidor = await iniciar(repositorioFalso({ registrarAnalise }));

      const resposta = await servidor.inject({
        method: 'POST',
        url: '/api/v1/scans',
        headers: AUTENTICADO,
        payload: { url: 'https://exemplo.com/' },
      });

      expect(resposta.statusCode).toBe(201);
      const corpo = resposta.json<{
        id: string;
        classificacao: string;
        analise: { status: string };
      }>();
      expect(corpo.id).toBe(ID_ANALISE);
      expect(corpo.classificacao).toBe('nao_identificado');
      expect(corpo.analise.status).toBe('fallback');
      expect(registrarAnalise).toHaveBeenCalledWith(
        TOKEN_VALIDO,
        expect.objectContaining({ normalizedUrl: 'https://exemplo.com/', host: 'exemplo.com' }),
      );
    });

    it('não grava nem consulta nada quando a URL é recusada', async () => {
      const buscarCorrespondencias = vi.fn().mockResolvedValue([]);
      const registrarAnalise = vi.fn().mockResolvedValue(ID_ANALISE);
      const servidor = await iniciar(
        repositorioFalso({ buscarCorrespondencias, registrarAnalise }),
      );

      const resposta = await servidor.inject({
        method: 'POST',
        url: '/api/v1/scans',
        headers: AUTENTICADO,
        payload: { url: 'http://127.0.0.1/admin' },
      });

      expect(resposta.statusCode).toBe(400);
      expect(resposta.json()).toEqual({
        error: {
          code: 'URL_INVALIDA',
          message: 'Endereços internos ou privados não são analisados.',
        },
      });
      expect(buscarCorrespondencias).not.toHaveBeenCalled();
      expect(registrarAnalise).not.toHaveBeenCalled();
    });

    it('recusa URL com credenciais', async () => {
      const servidor = await iniciar(repositorioFalso());

      const resposta = await servidor.inject({
        method: 'POST',
        url: '/api/v1/scans',
        headers: AUTENTICADO,
        payload: { url: 'https://usuario:senha@exemplo.com/' },
      });

      expect(resposta.json<{ error: { code: string } }>().error.code).toBe('URL_INVALIDA');
    });

    it('responde DADOS_INVALIDOS quando o campo url não é texto', async () => {
      const servidor = await iniciar(repositorioFalso());

      const resposta = await servidor.inject({
        method: 'POST',
        url: '/api/v1/scans',
        headers: AUTENTICADO,
        payload: { url: 42 },
      });

      expect(resposta.statusCode).toBe(400);
      expect(resposta.json<{ error: { code: string } }>().error.code).toBe('DADOS_INVALIDOS');
    });

    it('limita o número de análises por token e responde 429 quando passa do limite', async () => {
      const servidor = await iniciar(repositorioFalso());
      const codigos: number[] = [];
      for (let tentativa = 0; tentativa < 21; tentativa += 1) {
        const resposta = await servidor.inject({
          method: 'POST',
          url: '/api/v1/scans',
          headers: AUTENTICADO,
          payload: { url: 'https://exemplo.com/' },
        });
        codigos.push(resposta.statusCode);
      }

      expect(codigos.filter((codigo) => codigo === 201)).toHaveLength(20);
      expect(codigos.at(-1)).toBe(429);
    });
  });

  describe('GET /api/v1/scans/:id', () => {
    it('devolve a análise registrada', async () => {
      const servidor = await iniciar(
        repositorioFalso({ buscarAnalise: vi.fn().mockResolvedValue(analiseGravada()) }),
      );

      const resposta = await servidor.inject({
        method: 'GET',
        url: `/api/v1/scans/${ID_ANALISE}`,
        headers: AUTENTICADO,
      });

      expect(resposta.statusCode).toBe(200);
      expect(resposta.json<{ analise: { resumo: string } }>().analise.resumo).toBe(
        'Resumo de teste.',
      );
    });

    it('responde 404 quando o escaneamento não existe ou não é do usuário', async () => {
      const servidor = await iniciar(repositorioFalso());

      const resposta = await servidor.inject({
        method: 'GET',
        url: `/api/v1/scans/${ID_ANALISE}`,
        headers: AUTENTICADO,
      });

      expect(resposta.statusCode).toBe(404);
      expect(resposta.json<{ error: { code: string } }>().error.code).toBe('NAO_ENCONTRADO');
    });

    it('recusa identificador que não é UUID', async () => {
      const servidor = await iniciar(repositorioFalso());

      const resposta = await servidor.inject({
        method: 'GET',
        url: '/api/v1/scans/nao-e-uuid',
        headers: AUTENTICADO,
      });

      expect(resposta.statusCode).toBe(400);
    });
  });
});
