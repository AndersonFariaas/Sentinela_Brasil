import { z } from 'zod';

const DEFAULT_PORT = 3000;
const DEFAULT_CORS_ORIGIN = 'http://localhost:5173';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  CORS_ORIGIN: z
    .string()
    .default(DEFAULT_CORS_ORIGIN)
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  SUPABASE_URL: z.url(),
  // Chave pública (anon). Segura para uso no servidor, mas nunca dá acesso além da RLS.
  SUPABASE_ANON_KEY: z.string().min(1),
  // IA (Fase 6). Sem chave, o analista usa só o texto determinístico. Nunca vai para o front.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  IA_MODELO: z.string().min(1).optional(),
  IA_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).optional(),
});

export type Env = z.output<typeof envSchema>;

/**
 * Valida as variáveis de ambiente na inicialização.
 * A mensagem de erro cita só os nomes das variáveis, nunca os valores,
 * para não vazar segredos em logs.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const invalidas = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Configuração inválida nas variáveis de ambiente: ${invalidas}`);
  }

  return result.data;
}
