import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cliente: SupabaseClient | undefined;

/**
 * Cliente do Supabase para o Auth no navegador.
 * Criado na primeira chamada, então importar este módulo não exige variáveis de ambiente.
 * Usa só a chave pública (anon): a RLS do banco decide o que cada usuário acessa.
 */
export function obterClienteSupabase(): SupabaseClient {
  if (cliente) {
    return cliente;
  }

  const url = import.meta.env.VITE_SUPABASE_URL;
  const chaveAnonima = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !chaveAnonima) {
    throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.');
  }

  cliente = createClient(url, chaveAnonima);
  return cliente;
}
