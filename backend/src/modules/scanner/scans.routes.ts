import type { FastifyPluginCallback } from 'fastify';
import { z } from 'zod';
import { exigirUsuario, obterSessao } from '../auth/auth.guard.js';
import type { Autenticador } from '../auth/auth.types.js';
import { REGRAS_RISCO } from './regras.js';
import type { AnaliseRegistrada, RepositorioScans } from './repositorio.js';
import { analisarUrl } from './analisador.js';
import { validarUrlEntrada, type MotivoRejeicao } from './validacao.js';
import type { ResultadoAnalise } from './tipos.js';

interface OpcoesScansRoutes {
  autenticador: Autenticador;
  repositorio: RepositorioScans;
}

const corpoAnaliseSchema = z.object({ url: z.string() });
const parametroIdSchema = z.object({ id: z.uuid() });

const MENSAGENS_REJEICAO: Record<MotivoRejeicao, string> = {
  formato: 'Informe um endereço http ou https válido, com até 2048 caracteres.',
  protocolo: 'Só endereços http e https podem ser analisados.',
  credenciais: 'Endereços com usuário e senha não são aceitos.',
  interno: 'Endereços internos ou privados não são analisados.',
};

const ERRO_CORPO = {
  error: { code: 'DADOS_INVALIDOS', message: 'Informe a URL no campo "url".' },
};

const RESPOSTA_NAO_ENCONTRADA = {
  error: { code: 'NAO_ENCONTRADO', message: 'Registro não encontrado.' },
};

function serializarAnalise(analise: {
  id: string;
  url: string;
  host: string;
  criadaEm: string;
  versaoAlgoritmo: string;
  statusIa: string;
  resultado: ResultadoAnalise;
}) {
  const { resultado } = analise;

  return {
    id: analise.id,
    url: analise.url,
    host: analise.host,
    classificacao: resultado.classificacao,
    pontuacao: resultado.pontuacao,
    nivel: resultado.nivel,
    criadaEm: analise.criadaEm,
    evidencias: resultado.evidencias,
    fontes: resultado.fontes,
    analise: {
      status: analise.statusIa,
      ...resultado.explicacao,
    },
    algoritmo: analise.versaoAlgoritmo,
  };
}

export const scansRoutes: FastifyPluginCallback<OpcoesScansRoutes> = (
  app,
  { autenticador, repositorio },
  done,
) => {
  const protegida = { preHandler: exigirUsuario(autenticador) };

  app.post('/scans', protegida, async (request, reply) => {
    const corpo = corpoAnaliseSchema.safeParse(request.body);
    if (!corpo.success) {
      return reply.status(400).send(ERRO_CORPO);
    }

    const validacao = validarUrlEntrada(corpo.data.url);
    if (!validacao.ok) {
      return reply.status(400).send({
        error: { code: 'URL_INVALIDA', message: MENSAGENS_REJEICAO[validacao.motivo] },
      });
    }

    const { accessToken } = obterSessao(request);
    const { normalizada, host } = validacao;
    const resultado = await analisarUrl(
      { normalizada, host },
      repositorio,
      accessToken,
      REGRAS_RISCO,
    );

    const id = await repositorio.registrarAnalise(accessToken, {
      url: corpo.data.url.trim(),
      normalizedUrl: normalizada,
      host,
      versaoAlgoritmo: REGRAS_RISCO.versao,
      ...resultado,
    });

    return reply.status(201).send(
      serializarAnalise({
        id,
        url: corpo.data.url.trim(),
        host,
        criadaEm: new Date().toISOString(),
        versaoAlgoritmo: REGRAS_RISCO.versao,
        statusIa: 'fallback',
        resultado,
      }),
    );
  });

  app.get('/scans/:id', protegida, async (request, reply) => {
    const parametros = parametroIdSchema.safeParse(request.params);
    if (!parametros.success) {
      return reply.status(400).send({
        error: { code: 'DADOS_INVALIDOS', message: 'Identificador inválido.' },
      });
    }

    const { accessToken } = obterSessao(request);
    const analise: AnaliseRegistrada | null = await repositorio.buscarAnalise(
      accessToken,
      parametros.data.id,
    );
    if (!analise) {
      return reply.status(404).send(RESPOSTA_NAO_ENCONTRADA);
    }

    return serializarAnalise({
      id: analise.id,
      url: analise.url,
      host: analise.host,
      criadaEm: analise.criadaEm,
      versaoAlgoritmo: analise.versaoAlgoritmo,
      statusIa: analise.statusIa,
      resultado: {
        classificacao: analise.classificacao,
        pontuacao: analise.pontuacao,
        nivel: analise.nivel,
        evidencias: analise.evidencias,
        fontes: analise.fontes,
        explicacao: analise.explicacao,
      },
    });
  });

  done();
};
