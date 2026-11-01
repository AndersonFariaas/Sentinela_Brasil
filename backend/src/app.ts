import type { Writable } from 'node:stream';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import Fastify, { type FastifyInstance } from 'fastify';
import { criarOpcoesLogger } from './config/logger.js';
import type { Env } from './config/env.js';
import { criarAutenticadorSupabase } from './integrations/supabase/autenticador.js';
import { criarLeitorAmeacasSupabase } from './integrations/supabase/leitor-ameacas.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import type { Autenticador } from './modules/auth/auth.types.js';
import { healthRoutes } from './modules/health/health.routes.js';
import type { LeitorAmeacas } from './modules/threats/leitor.js';
import { threatsRoutes } from './modules/threats/threats.routes.js';

export const PREFIXO_API = '/api/v1';

/** Erros do Fastify trazem status e código, mas erros lançados à mão podem não ter. */
interface ErroHttp extends Error {
  statusCode?: number | undefined;
  code?: string | undefined;
}

interface OpcoesApp {
  /** Stream alternativo do logger. Usado nos testes para inspecionar a saída. */
  logStream?: Writable;
  /** Autenticador alternativo. Os testes usam uma versão falsa, sem rede. */
  autenticador?: Autenticador;
  /** Leitor do Threat Feed alternativo. Mesmo papel do autenticador: testes sem rede. */
  leitor?: LeitorAmeacas;
}

export async function buildApp(env: Env, opcoes: OpcoesApp = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: criarOpcoesLogger(env, { stream: opcoes.logStream }),
  });

  const autenticador = opcoes.autenticador ?? criarAutenticadorSupabase(env);
  const leitor = opcoes.leitor ?? criarLeitorAmeacasSupabase(env);

  await app.register(helmet);
  await app.register(cors, { origin: env.CORS_ORIGIN });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } });
  });

  app.setErrorHandler((error: ErroHttp, request, reply) => {
    const status = error.statusCode ?? 500;

    if (status >= 500) {
      request.log.error({ err: error }, 'erro não tratado');
    }

    const message = status >= 500 ? 'Erro interno do servidor.' : error.message;
    reply.status(status).send({ error: { code: error.code ?? 'INTERNAL_ERROR', message } });
  });

  await app.register(healthRoutes, { prefix: PREFIXO_API });
  await app.register(authRoutes, { prefix: PREFIXO_API, autenticador });
  await app.register(threatsRoutes, { prefix: PREFIXO_API, autenticador, leitor });

  return app;
}
