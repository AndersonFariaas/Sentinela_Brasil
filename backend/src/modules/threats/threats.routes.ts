import type { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import { exigirUsuario, obterSessao } from '../auth/auth.guard.js';
import type { Autenticador } from '../auth/auth.types.js';
import {
  consultaAmeacasSchema,
  consultaIndicadoresSchema,
  parametroIdSchema,
} from './threats.schemas.js';
import type { AmeacaDetalhe, AmeacaResumo, IndicadorResumo, LeitorAmeacas } from './leitor.js';

interface OpcoesThreatsRoutes {
  autenticador: Autenticador;
  leitor: LeitorAmeacas;
}

const ERRO_PARAMETROS = (campos: string[]) => ({
  error: {
    code: 'DADOS_INVALIDOS',
    message: `Parâmetros inválidos: ${campos.join(', ')}.`,
  },
});

function camposComErro(erros: { issues: { path: PropertyKey[] }[] }): string[] {
  return [...new Set(erros.issues.map((issue) => String(issue.path[0] ?? 'parametro')))];
}

function serializarAmeaca(ameaca: AmeacaResumo) {
  return {
    id: ameaca.id,
    titulo: ameaca.titulo,
    descricao: ameaca.descricao,
    categoria: ameaca.categoria,
    severidade: ameaca.severidade,
    estadoVerificacao: ameaca.estadoVerificacao,
    cveId: ameaca.cveId,
    urlFonte: ameaca.urlFonte,
    fonte: ameaca.fonte,
    publicadoEm: ameaca.publicadoEm,
    coletadoEm: ameaca.coletadoEm,
    ultimaVerificacao: ameaca.ultimaVerificacao,
  };
}

function serializarIndicador(indicador: IndicadorResumo) {
  return {
    id: indicador.id,
    tipo: indicador.tipo,
    valor: indicador.valor,
    confianca: indicador.confianca,
    primeiraVez: indicador.primeiraVez,
    ultimaVez: indicador.ultimaVez,
  };
}

function serializarDetalhe(ameaca: AmeacaDetalhe) {
  return { ...serializarAmeaca(ameaca), indicadores: ameaca.indicadores.map(serializarIndicador) };
}

const RESPOSTA_NAO_ENCONTRADA = {
  error: { code: 'NAO_ENCONTRADO', message: 'Registro não encontrado.' },
};

export const threatsRoutes: FastifyPluginCallback<OpcoesThreatsRoutes> = (
  app,
  { autenticador, leitor },
  done,
) => {
  const protegida = { preHandler: exigirUsuario(autenticador) };

  app.get('/threats', protegida, async (request, reply) => {
    const consulta = consultaAmeacasSchema.safeParse(request.query);
    if (!consulta.success) {
      return reply.status(400).send(ERRO_PARAMETROS(camposComErro(consulta.error)));
    }

    const { accessToken } = obterSessao(request);
    const { limite, pagina, categoria, severidade } = consulta.data;
    // Pede um item a mais para saber se existe próxima página sem contar o total.
    const linhas = await leitor.listarAmeacas(accessToken, {
      categoria,
      severidade,
      limite: limite + 1,
      pagina,
    });

    return {
      itens: linhas.slice(0, limite).map(serializarAmeaca),
      pagina,
      limite,
      temMais: linhas.length > limite,
    };
  });

  app.get('/threats/:id', protegida, async (request, reply: FastifyReply) => {
    const parametros = parametroIdSchema.safeParse(request.params);
    if (!parametros.success) {
      return reply.status(400).send(ERRO_PARAMETROS(['id']));
    }

    const { accessToken } = obterSessao(request);
    const ameaca = await leitor.buscarAmeaca(accessToken, parametros.data.id);

    if (!ameaca) {
      return reply.status(404).send(RESPOSTA_NAO_ENCONTRADA);
    }
    return serializarDetalhe(ameaca);
  });

  app.get('/indicators', protegida, async (request: FastifyRequest, reply) => {
    const consulta = consultaIndicadoresSchema.safeParse(request.query);
    if (!consulta.success) {
      return reply.status(400).send(ERRO_PARAMETROS(camposComErro(consulta.error)));
    }

    const { accessToken } = obterSessao(request);
    const { limite, pagina, tipo } = consulta.data;
    const linhas = await leitor.listarIndicadores(accessToken, {
      tipo,
      limite: limite + 1,
      pagina,
    });

    return {
      itens: linhas.slice(0, limite).map(serializarIndicador),
      pagina,
      limite,
      temMais: linhas.length > limite,
    };
  });

  app.get('/indicators/:id', protegida, async (request, reply) => {
    const parametros = parametroIdSchema.safeParse(request.params);
    if (!parametros.success) {
      return reply.status(400).send(ERRO_PARAMETROS(['id']));
    }

    const { accessToken } = obterSessao(request);
    const indicador = await leitor.buscarIndicador(accessToken, parametros.data.id);

    if (!indicador) {
      return reply.status(404).send(RESPOSTA_NAO_ENCONTRADA);
    }
    return serializarIndicador(indicador);
  });

  done();
};
