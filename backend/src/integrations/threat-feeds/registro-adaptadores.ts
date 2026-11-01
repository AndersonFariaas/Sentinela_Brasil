import type { AdaptadorFonte, FonteAtiva } from '../../modules/intelligence/tipos.js';
import { AdaptadorCisaKev } from './cisa-kev.js';

/**
 * Liga o nome cadastrado na tabela sources ao adaptador que sabe ler aquela fonte.
 * Fonte sem adaptador aqui é ignorada pela ingestão, sem gerar erro.
 */
export function criarAdaptador(fonte: FonteAtiva): AdaptadorFonte | undefined {
  switch (fonte.nome) {
    case 'CISA KEV':
      return new AdaptadorCisaKev(fonte.urlBase);
    default:
      return undefined;
  }
}
