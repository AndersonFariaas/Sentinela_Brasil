import type { CategoriaAmeaca } from '../intelligence/tipos.js';

export interface InscricaoCategoria {
  categoria: CategoriaAmeaca;
  ativa: boolean;
}

/**
 * Porta das inscrições do usuário. Todas as chamadas recebem o token dele, então a RLS
 * da tabela `subscriptions` continua valendo. Os testes usam uma versão em memória.
 */
export interface RepositorioInscricoes {
  /** Só as categorias que já têm registro. As demais são tratadas como inativas. */
  listar(accessToken: string): Promise<InscricaoCategoria[]>;
  definir(
    accessToken: string,
    usuarioId: string,
    categoria: CategoriaAmeaca,
    ativa: boolean,
  ): Promise<void>;
}
