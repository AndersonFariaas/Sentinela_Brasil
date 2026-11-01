export const PAPEIS = ['user', 'analyst', 'admin'] as const;

export type Papel = (typeof PAPEIS)[number];

/** Identidade verificada no token. Nunca vem do corpo da requisição. */
export interface Usuario {
  id: string;
  email: string;
}

export interface Perfil {
  id: string;
  email: string;
  fullName: string | null;
  role: Papel;
}

/**
 * Contrato de autenticação usado pelo módulo auth.
 * A implementação real fica em integrations/supabase, o que permite testar as rotas sem rede.
 */
export interface Autenticador {
  /** Retorna o usuário dono do token, ou null se o token for inválido ou expirado. */
  verificarToken(token: string): Promise<Usuario | null>;
  /** Lê o perfil com o token do próprio usuário, então a RLS também é aplicada. */
  buscarPerfil(token: string, usuarioId: string): Promise<Perfil | null>;
}

declare module 'fastify' {
  interface FastifyRequest {
    usuario?: Usuario;
    accessToken?: string;
  }
}
