import type { preHandlerAsyncHookHandler } from 'fastify';
import type { Autenticador, Usuario } from './auth.types.js';

// Formato do token do Supabase: JWT com caracteres base64url e pontos.
const PADRAO_BEARER = /^Bearer ([A-Za-z0-9._-]{1,4096})$/;

const ERRO_NAO_AUTENTICADO = {
  error: { code: 'NAO_AUTENTICADO', message: 'Autenticação necessária.' },
};

export function extrairTokenBearer(cabecalho: string | undefined): string | null {
  const resultado = cabecalho ? PADRAO_BEARER.exec(cabecalho) : null;
  return resultado?.[1] ?? null;
}

/** Recusa a requisição sem token válido. Aplicado como preHandler nas rotas protegidas. */
export function exigirUsuario(autenticador: Autenticador): preHandlerAsyncHookHandler {
  return async (request, reply) => {
    const token = extrairTokenBearer(request.headers.authorization);
    const usuario = token ? await autenticador.verificarToken(token) : null;

    if (!token || !usuario) {
      return reply.status(401).send(ERRO_NAO_AUTENTICADO);
    }

    request.usuario = usuario;
    request.accessToken = token;
  };
}

/**
 * Lê a sessão preenchida pelo guard.
 * Se a rota não tiver o guard, é erro de programação, então lança exceção (vira 500).
 */
export function obterSessao(request: { usuario?: Usuario; accessToken?: string }): {
  usuario: Usuario;
  accessToken: string;
} {
  if (!request.usuario || !request.accessToken) {
    throw new Error('Rota protegida acessada sem exigirUsuario aplicado.');
  }

  return { usuario: request.usuario, accessToken: request.accessToken };
}
