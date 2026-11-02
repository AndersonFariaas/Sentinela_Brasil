import type { Writable } from 'node:stream';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import Fastify, { type FastifyInstance } from 'fastify';
import { criarOpcoesLogger } from './config/logger.js';
import type { Env } from './config/env.js';
import { criarAutenticadorSupabase } from './integrations/supabase/autenticador.js';
import { criarLeitorAmeacasSupabase } from './integrations/supabase/leitor-ameacas.js';
import { criarRepositorioScansSupabase } from './integrations/supabase/repositorio-scans.js';
import { criarCancelarInscricaoSupabase } from './integrations/supabase/cancelamento-supabase.js';
import { criarRepositorioInscricoesSupabase } from './integrations/supabase/repositorio-inscricoes.js';
import { inscricoesRoutes } from './modules/alerts/inscricoes.routes.js';
import type { RepositorioInscricoes } from './modules/alerts/inscricoes.js';
import {
  cancelamentoRoutes,
  type CancelarInscricao,
} from './modules/alerts/cancelamento.routes.js';
import { criarProvedorIaPadrao, TIMEOUT_IA_PADRAO_MS } from './integrations/ia/anthropic.js';
import type { ProvedorIa } from './modules/ai-analyst/provedor.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import type { Autenticador } from './modules/auth/auth.types.js';
import { healthRoutes } from './modules/health/health.routes.js';
import type { RepositorioScans } from './modules/scanner/repositorio.js';
import { scansRoutes } from './modules/scanner/scans.routes.js';
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
  /** Repositório do scanner alternativo. Os testes usam uma versão em memória. */
  repositorioScans?: RepositorioScans;
  /** Provedor de IA alternativo. Null força o texto determinístico (testes e ambientes sem chave). */
  provedorIa?: ProvedorIa | null;
  /** Cancelamento de inscrição alternativo. Os testes usam uma versão em memória. */
  cancelarInscricao?: CancelarInscricao;
  /** Repositório das inscrições em alertas alternativo. Os testes usam uma versão em memória. */
  repositorioInscricoes?: RepositorioInscricoes;
}

export async function buildApp(env: Env, opcoes: OpcoesApp = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: criarOpcoesLogger(env, { stream: opcoes.logStream }),
  });

  const autenticador = opcoes.autenticador ?? criarAutenticadorSupabase(env);
  const leitor = opcoes.leitor ?? criarLeitorAmeacasSupabase(env);
  const repositorioScans = opcoes.repositorioScans ?? criarRepositorioScansSupabase(env);
  const provedorIa =
    opcoes.provedorIa !== undefined ? opcoes.provedorIa : criarProvedorIaPadrao(env);

  await app.register(helmet);
  await app.register(cors, { origin: env.CORS_ORIGIN });
  // Global desligado: cada rota declara o próprio limite.
  await app.register(rateLimit, { global: false });

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
  await app.register(scansRoutes, {
    prefix: PREFIXO_API,
    autenticador,
    repositorio: repositorioScans,
    ia: { provedor: provedorIa, timeoutMs: env.IA_TIMEOUT_MS ?? TIMEOUT_IA_PADRAO_MS },
  });
  await app.register(cancelamentoRoutes, {
    prefix: PREFIXO_API,
    cancelar: opcoes.cancelarInscricao ?? criarCancelarInscricaoSupabase(env),
  });
  await app.register(inscricoesRoutes, {
    prefix: PREFIXO_API,
    autenticador,
    repositorio: opcoes.repositorioInscricoes ?? criarRepositorioInscricoesSupabase(env),
  });

  return app;
}
