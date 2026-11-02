import type { RepositorioRetencao } from '../../modules/retention/limpeza.service.js';
import type { ClienteSupabase } from './clientes.js';

/**
 * Acesso de manutenção com service_role, que ignora a RLS.
 * Só o job de limpeza usa este repositório. Nunca é exposto em rota.
 */
export function criarRepositorioRetencao(cliente: ClienteSupabase): RepositorioRetencao {
  return {
    async contarAnteriores(regra, limite) {
      const { count, error } = await cliente
        .from(regra.tabela)
        .select('*', { count: 'exact', head: true })
        .lt(regra.colunaData, limite.toISOString());

      if (error) {
        throw new Error(`Falha ao contar registros antigos em ${regra.tabela}: ${error.message}`);
      }
      return count ?? 0;
    },

    async removerAnteriores(regra, limite) {
      const { count, error } = await cliente
        .from(regra.tabela)
        .delete({ count: 'exact' })
        .lt(regra.colunaData, limite.toISOString());

      if (error) {
        throw new Error(`Falha ao apagar registros antigos em ${regra.tabela}: ${error.message}`);
      }
      return count ?? 0;
    },

    async registrarLimpeza(resumo) {
      const { error } = await cliente.from('audit_log').insert({
        action: 'retencao.limpeza',
        entity: 'sistema',
        entity_id: null,
        actor_id: null,
        metadata: resumo,
      });

      if (error) {
        throw new Error(`Falha ao registrar a limpeza na auditoria: ${error.message}`);
      }
    },
  };
}
