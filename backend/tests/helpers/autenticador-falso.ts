import type { Autenticador, Perfil, Usuario } from '../../src/modules/auth/auth.types.js';

export const TOKEN_VALIDO = 'token-valido-de-teste';

export const USUARIO_TESTE: Usuario = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'usuario@sentinela.dev',
};

export const PERFIL_TESTE: Perfil = {
  id: USUARIO_TESTE.id,
  email: USUARIO_TESTE.email,
  fullName: 'Usuário de Teste',
  role: 'user',
};

/**
 * Autenticador sem rede para os testes unitários.
 * Aceita só TOKEN_VALIDO e devolve o perfil de teste. Quem precisa de outro cenário
 * sobrescreve os métodos.
 */
export function criarAutenticadorFalso(sobrescrever: Partial<Autenticador> = {}): Autenticador {
  return {
    verificarToken: (token) => Promise.resolve(token === TOKEN_VALIDO ? USUARIO_TESTE : null),
    buscarPerfil: () => Promise.resolve(PERFIL_TESTE),
    ...sobrescrever,
  };
}
