import { z } from 'zod';
import type { Env } from '../../config/env.js';
import { CATEGORIAS_AMEACA, type CategoriaAmeaca } from '../../modules/intelligence/tipos.js';
import type { RepositorioInscricoes } from '../../modules/alerts/inscricoes.js';
import { criarClienteDoUsuario } from './clientes.js';

type ConfigSupabase = Pick<Env, 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'>;

const linhaInscricaoSchema = z.object({
  category: z.enum(CATEGORIAS_AMEACA),
  enabled: z.boolean(),
});

function garantirSemErro(erro: { message: string } | null, contexto: string): void {
  if (erro) {
    throw new Error(`${contexto}: ${erro.message}`);
  }
}

export function criarRepositorioInscricoesSupabase(config: ConfigSupabase): RepositorioInscricoes {
  return {
    async listar(accessToken) {
      const cliente = criarClienteDoUsuario(config, accessToken);
      const { data, error } = await cliente.from('subscriptions').select('category, enabled');
      garantirSemErro(error, 'Falha ao listar inscrições');

      return (data ?? []).map((linha) => {
        const valida = linhaInscricaoSchema.parse(linha);
        return { categoria: valida.category, ativa: valida.enabled };
      });
    },

    async definir(accessToken, usuarioId, categoria: CategoriaAmeaca, ativa) {
      const cliente = criarClienteDoUsuario(config, accessToken);

      // Duas etapas de propósito. O upsert do PostgREST regrava todas as colunas do payload,
      // e a permissão de UPDATE da tabela cobre só `enabled`. Assim a escrita fica dentro do que o banco permite.
      const { data: existente, error: erroBusca } = await cliente
        .from('subscriptions')
        .select('id')
        .eq('category', categoria)
        .maybeSingle();
      garantirSemErro(erroBusca, 'Falha ao buscar inscrição');

      if (existente) {
        const { error } = await cliente
          .from('subscriptions')
          .update({ enabled: ativa })
          .eq('id', existente.id);
        garantirSemErro(error, 'Falha ao atualizar inscrição');
        return;
      }

      const { error } = await cliente
        .from('subscriptions')
        .insert({ user_id: usuarioId, category: categoria, enabled: ativa });
      garantirSemErro(error, 'Falha ao criar inscrição');
    },
  };
}
