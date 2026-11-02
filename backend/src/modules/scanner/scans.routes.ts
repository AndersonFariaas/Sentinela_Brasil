import { createHash } from 'node:crypto';
import type { FastifyBaseLogger, FastifyPluginCallback, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { exigirUsuario, extrairTokenBearer, obterSessao } from '../auth/auth.guard.js';
import type { Autenticador } from '../auth/auth.types.js';
import { REGRAS_RISCO } from './regras.js';
import type { AnaliseRegistrada, RegistroAnaliseIa, RepositorioScans } from './repositorio.js';
import { analisarUrl } from './analisador.js';
import { validarUrlEntrada, type MotivoRejeicao } from './validacao.js';
import type { Explicacao, ResultadoAnalise } from './tipos.js';
import { analisarComIa, type OpcoesAnaliseIa } from '../ai-analyst/analista.js';

interface OpcoesScansRoutes {
  autenticador: Autenticador;
  repositorio: RepositorioScans;
  ia: OpcoesAnaliseIa;
}

const VERSAO_FALLBACK = 'fallback-1';

const REGISTRO_SEM_IA: RegistroAnaliseIa = {
  status: 'fallback',
  provedor: 'deterministico',
  modelo: null,
  versaoPrompt: VERSAO_FALLBACK,
  evidenciasCitadas: [],
};

const corpoAnaliseSchema = z.object({ url: z.string() });
const parametroIdSchema = z.object({ id: z.uuid() });

// Limite máximo evita carregar o histórico inteiro de uma vez.
const consultaHistoricoSchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(20),
});

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

// Cada análise grava no banco e pode chamar a IA, então o limite protege custo e disponibilidade.
const LIMITE_ANALISES = { max: 20, timeWindow: '1 minute' } as const;

/**
 * Chave do limite: o hash do token, para que um usuário não seja confundido com outro
 * atrás do mesmo IP. Sem token, usa o IP (a requisição será recusada logo depois).
 * O token em si nunca é guardado.
 */
function chaveDeLimite(request: FastifyRequest): string {
  const token = extrairTokenBearer(request.headers.authorization);
  return token ? createHash('sha256').update(token).digest('hex') : request.ip;
}

function serializarAnalise(analise: {
  id: string;
  url: string;
  host: string;
  criadaEm: string;
  versaoAlgoritmo: string;
  analiseIa: RegistroAnaliseIa;
  resultado: ResultadoAnalise;
}) {
  const { resultado, analiseIa } = analise;

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
      status: analiseIa.status,
      modelo: analiseIa.modelo,
      evidenciasCitadas: analiseIa.evidenciasCitadas,
      ...resultado.explicacao,
    },
    algoritmo: analise.versaoAlgoritmo,
  };
}

/**
 * Usa a explicação da IA só quando ela passou na validação. Em qualquer outro caso,
 * mantém o texto determinístico. O motivo da falha vai para o log, nunca para o usuário.
 */
async function explicarResultado(
  ia: OpcoesAnaliseIa,
  resultado: ResultadoAnalise,
  host: string,
  log: FastifyBaseLogger,
): Promise<{ explicacao: Explicacao; registroIa: RegistroAnaliseIa }> {
  const respostaIa = await analisarComIa(ia, {
    classificacao: resultado.classificacao,
    pontuacao: resultado.pontuacao,
    nivel: resultado.nivel,
    host,
    evidencias: resultado.evidencias,
    fontes: resultado.fontes,
  });

  if (respostaIa.status === 'ok') {
    const { evidenciasCitadas, ...explicacao } = respostaIa.explicacao;
    return {
      explicacao,
      registroIa: {
        status: 'ok',
        provedor: respostaIa.provedor,
        modelo: respostaIa.modelo,
        versaoPrompt: respostaIa.versaoPrompt,
        evidenciasCitadas,
      },
    };
  }

  if (respostaIa.motivo !== 'desativada') {
    log.warn({ motivoIa: respostaIa.motivo }, 'análise sem IA: texto determinístico');
  }
  return { explicacao: resultado.explicacao, registroIa: REGISTRO_SEM_IA };
}

export const scansRoutes: FastifyPluginCallback<OpcoesScansRoutes> = (
  app,
  { autenticador, repositorio, ia },
  done,
) => {
  const protegida = { preHandler: exigirUsuario(autenticador) };
  const comLimite = {
    ...protegida,
    config: { rateLimit: { ...LIMITE_ANALISES, keyGenerator: chaveDeLimite } },
  };

  app.post('/scans', comLimite, async (request, reply) => {
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
    const resultadoMotor = await analisarUrl(
      { normalizada, host },
      repositorio,
      accessToken,
      REGRAS_RISCO,
    );
    const { explicacao, registroIa } = await explicarResultado(
      ia,
      resultadoMotor,
      host,
      request.log,
    );
    const resultado: ResultadoAnalise = { ...resultadoMotor, explicacao };
    const url = corpo.data.url.trim();

    const id = await repositorio.registrarAnalise(accessToken, {
      url,
      normalizedUrl: normalizada,
      host,
      versaoAlgoritmo: REGRAS_RISCO.versao,
      ...resultado,
      analiseIa: registroIa,
    });

    return reply.status(201).send(
      serializarAnalise({
        id,
        url,
        host,
        criadaEm: new Date().toISOString(),
        versaoAlgoritmo: REGRAS_RISCO.versao,
        analiseIa: registroIa,
        resultado,
      }),
    );
  });

  app.get('/scans', protegida, async (request, reply) => {
    const consulta = consultaHistoricoSchema.safeParse(request.query);
    if (!consulta.success) {
      return reply.status(400).send({
        error: { code: 'DADOS_INVALIDOS', message: 'Página ou limite inválidos.' },
      });
    }

    const { pagina, limite } = consulta.data;
    const { accessToken } = obterSessao(request);
    const resultado = await repositorio.listarAnalises(accessToken, {
      deslocamento: (pagina - 1) * limite,
      limite,
    });

    return {
      itens: resultado.itens,
      pagina,
      limite,
      temMais: resultado.temMais,
    };
  });

  app.delete('/scans/:id', protegida, async (request, reply) => {
    const parametros = parametroIdSchema.safeParse(request.params);
    if (!parametros.success) {
      return reply.status(400).send({
        error: { code: 'DADOS_INVALIDOS', message: 'Identificador inválido.' },
      });
    }

    const { accessToken } = obterSessao(request);
    const excluida = await repositorio.excluirAnalise(accessToken, parametros.data.id);
    if (!excluida) {
      return reply.status(404).send(RESPOSTA_NAO_ENCONTRADA);
    }

    return reply.status(204).send();
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
      analiseIa: analise.analiseIa,
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
