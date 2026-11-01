import type { Writable } from 'node:stream';
import type { Env } from './env.js';

const CENSURA = '[REDATADO]';

/**
 * Campos que nunca podem aparecer em log. Cobre cabeçalhos de autenticação
 * e campos com nomes comuns de segredo, na raiz e um nível abaixo.
 */
export const CAMPOS_SENSIVEIS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
  '*.headers.authorization',
  '*.headers.cookie',
  'password',
  '*.password',
  'token',
  '*.token',
  'apiKey',
  '*.apiKey',
  'serviceRole',
  '*.serviceRole',
  'secret',
  '*.secret',
];

interface OpcoesLogger {
  stream?: Writable | undefined;
}

export function criarOpcoesLogger(env: Pick<Env, 'LOG_LEVEL'>, { stream }: OpcoesLogger = {}) {
  return {
    level: env.LOG_LEVEL,
    redact: { paths: CAMPOS_SENSIVEIS, censor: CENSURA },
    ...(stream ? { stream } : {}),
  };
}
