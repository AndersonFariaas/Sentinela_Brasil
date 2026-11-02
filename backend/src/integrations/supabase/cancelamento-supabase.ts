import type { Env } from '../../config/env.js';
import type { CancelarInscricao } from '../../modules/alerts/cancelamento.routes.js';
import { criarClienteAnonimo } from './clientes.js';

/**
 * Chama a função cancelar_inscricao com a chave pública. Não usa service_role:
 * a função tem escopo mínimo (só desativa uma inscrição pelo id).
 */
export function criarCancelarInscricaoSupabase(
  config: Pick<Env, 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'>,
): CancelarInscricao {
  const cliente = criarClienteAnonimo(config);

  return async (inscricaoId) => {
    const { error } = await cliente.rpc('cancelar_inscricao', { p_inscricao_id: inscricaoId });
    if (error) {
      throw new Error(`Falha ao cancelar inscrição: ${error.message}`);
    }
  };
}
