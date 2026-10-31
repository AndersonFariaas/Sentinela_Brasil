import type { FastifyPluginCallback } from 'fastify';
import { exigirUsuario, obterSessao } from './auth.guard.js';
import type { Autenticador } from './auth.types.js';

interface OpcoesAuthRoutes {
  autenticador: Autenticador;
}

export const authRoutes: FastifyPluginCallback<OpcoesAuthRoutes> = (
  app,
  { autenticador },
  done,
) => {
  app.get('/auth/me', { preHandler: exigirUsuario(autenticador) }, async (request, reply) => {
    const { usuario, accessToken } = obterSessao(request);
    const perfil = await autenticador.buscarPerfil(accessToken, usuario.id);

    if (!perfil) {
      return reply.status(404).send({
        error: { code: 'PERFIL_NAO_ENCONTRADO', message: 'Perfil não encontrado.' },
      });
    }

    return {
      id: perfil.id,
      email: perfil.email,
      fullName: perfil.fullName,
      role: perfil.role,
    };
  });

  done();
};
