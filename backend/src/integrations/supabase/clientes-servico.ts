import { createClient } from '@supabase/supabase-js';
import type { ClienteSupabase } from './clientes.js';
import type { Database } from './database.types.js';

export interface ConfigServico {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

/**
 * Cliente com a chave service_role: ignora a RLS.
 * Usar só em tarefas do servidor, como a ingestão. Nunca em rotas acessadas pelo usuário.
 */
export function criarClienteServico(config: ConfigServico): ClienteSupabase {
  return createClient<Database>(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
