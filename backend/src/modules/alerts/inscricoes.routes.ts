import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';
import { exigirUsuario, obterSessao } from '../auth/auth.guard.js';
import type { Autenticador } from '../auth/auth.types.js';
import { CATEGORIAS_AMEACA, type CategoriaAmeaca } from '../intelligence/tipos.js';
import type { InscricaoCategoria, RepositorioInscricoes } from './inscricoes.js';

interface OpcoesInscricoesRoutes {
  autenticador: Autenticador;
  repositorio: RepositorioInscricoes;
}

const parametrosSchema = z.object({ categoria: z.enum(CATEGORIAS_AMEACA) });
const corpoSchema = z.object({ ativa: z.boolean() }).strict();

/** Todas as categorias aparecem na resposta, mesmo sem registro: sem registro é inativa. */
function completarCategorias(existentes: InscricaoCategoria[]): InscricaoCategoria[] {
  const ativas = new Map(existentes.map((inscricao) => [inscricao.categoria, inscricao.ativa]));
  return CATEGORIAS_AMEACA.map((categoria: CategoriaAmeaca) => ({
    categoria,
    ativa: ativas.get(categoria) ?? false,
  }));
}

export const inscricoesRoutes: FastifyPluginCallback<OpcoesInscricoesRoutes> = (
  app,
  { autenticador, repositorio },
  done,
) => {
  const protegida = { preHandler: exigirUsuario(autenticador) };

  app.get('/alertas/inscricoes', protegida, async (request) => {
    const { accessToken } = obterSessao(request);
    const existentes = await repositorio.listar(accessToken);

    return { inscricoes: completarCategorias(existentes) };
  });

  app.put('/alertas/inscricoes/:categoria', protegida, async (request, reply) => {
    const parametros = parametrosSchema.safeParse(request.params);
    const corpo = corpoSchema.safeParse(request.body);
    if (!parametros.success || !corpo.success) {
      return reply.status(400).send({
        error: {
          code: 'DADOS_INVALIDOS',
          message: 'Informe uma categoria válida e "ativa" como verdadeiro ou falso.',
        },
      });
    }

    const { accessToken, usuario } = obterSessao(request);
    const { categoria } = parametros.data;
    const { ativa } = corpo.data;
    await repositorio.definir(accessToken, usuario.id, categoria, ativa);

    return { categoria, ativa };
  });

  done();
};
