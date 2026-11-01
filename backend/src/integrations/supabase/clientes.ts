import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../../config/env.js';
import type { Database } from './database.types.js';

type ConfigSupabase = Pick<Env, 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'>;

export type ClienteSupabase = SupabaseClient<Database>;

// O back-end não guarda sessão: cada requisição carrega o próprio token.
const OPCOES_SEM_SESSAO = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

/** Cliente sem usuário. Serve para validar tokens no Auth. */
export function criarClienteAnonimo(config: ConfigSupabase): ClienteSupabase {
  return createClient<Database>(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, OPCOES_SEM_SESSAO);
}

/** Cliente que age como o usuário dono do token. A RLS do banco vale para ele. */
export function criarClienteDoUsuario(
  config: ConfigSupabase,
  accessToken: string,
): ClienteSupabase {
  return createClient<Database>(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    ...OPCOES_SEM_SESSAO,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
