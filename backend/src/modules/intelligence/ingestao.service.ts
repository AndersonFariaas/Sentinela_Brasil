import { ErroColeta } from './erros.js';
import type { AdaptadorFonte, AmeacaColetada, FonteAtiva } from './tipos.js';

/** Depois de tantas falhas seguidas, a fonte é desativada até alguém reativá-la manualmente. */
export const LIMITE_FALHAS_CONSECUTIVAS = 5;

const MENSAGEM_FALHA_GENERICA = 'Falha inesperada na coleta.';

export interface EstatisticasGravacao {
  novas: number;
  atualizadas: number;
}

export interface ResultadoExecucao {
  status: 'ok' | 'error';
  recebidos: number;
  novas: number;
  atualizadas: number;
  descartados: number;
  erro: string | null;
}

/** Contrato de persistência. A implementação com Supabase fica em integrations/supabase. */
export interface RepositorioIngestao {
  listarFontesAtivas(): Promise<FonteAtiva[]>;
  iniciarExecucao(fonteId: string): Promise<string>;
  salvarAmeacas(
    execucaoId: string,
    fonteId: string,
    ameacas: AmeacaColetada[],
  ): Promise<EstatisticasGravacao>;
  concluirExecucao(execucaoId: string, resultado: ResultadoExecucao): Promise<void>;
  registrarSucesso(fonteId: string): Promise<void>;
  /** Soma uma falha à fonte e devolve o total de falhas seguidas. */
  registrarFalha(fonteId: string, mensagem: string): Promise<number>;
  desativarFonte(fonteId: string): Promise<void>;
}

export interface ResumoFonte {
  fonte: string;
  status: 'ok' | 'erro' | 'ignorada';
  recebidos: number;
  novas: number;
  atualizadas: number;
  descartados: number;
  erro: string | null;
}

export type CriadorAdaptador = (fonte: FonteAtiva) => AdaptadorFonte | undefined;

export type Registrador = (evento: string, dados: Record<string, unknown>) => void;

/** Só mensagens nossas chegam ao banco. Erros inesperados viram uma mensagem genérica. */
function mensagemSegura(erro: unknown): string {
  return erro instanceof ErroColeta ? erro.message : MENSAGEM_FALHA_GENERICA;
}

/**
 * Coleta todas as fontes ativas que têm adaptador. Uma fonte com erro não impede as demais.
 * Fontes sem adaptador são ignoradas, sem contar como falha.
 */
export async function executarIngestao(
  repositorio: RepositorioIngestao,
  criarAdaptador: CriadorAdaptador,
  registrar: Registrador,
): Promise<ResumoFonte[]> {
  const resumos: ResumoFonte[] = [];

  for (const fonte of await repositorio.listarFontesAtivas()) {
    const adaptador = criarAdaptador(fonte);

    if (!adaptador) {
      registrar('ingestao.fonte_ignorada', { fonte: fonte.nome, motivo: 'sem adaptador' });
      resumos.push(resumoVazio(fonte.nome, 'ignorada', null));
      continue;
    }

    resumos.push(await coletarFonte(repositorio, fonte, adaptador, registrar));
  }

  return resumos;
}

async function coletarFonte(
  repositorio: RepositorioIngestao,
  fonte: FonteAtiva,
  adaptador: AdaptadorFonte,
  registrar: Registrador,
): Promise<ResumoFonte> {
  const execucaoId = await repositorio.iniciarExecucao(fonte.id);

  try {
    const coleta = await adaptador.coletar();
    const gravacao = await repositorio.salvarAmeacas(execucaoId, fonte.id, coleta.ameacas);

    const resultado: ResultadoExecucao = {
      status: 'ok',
      recebidos: coleta.ameacas.length,
      novas: gravacao.novas,
      atualizadas: gravacao.atualizadas,
      descartados: coleta.descartados,
      erro: null,
    };

    await repositorio.concluirExecucao(execucaoId, resultado);
    await repositorio.registrarSucesso(fonte.id);
    registrar('ingestao.fonte_ok', { fonte: fonte.nome, ...resultado });

    return {
      fonte: fonte.nome,
      status: 'ok',
      recebidos: resultado.recebidos,
      novas: resultado.novas,
      atualizadas: resultado.atualizadas,
      descartados: resultado.descartados,
      erro: null,
    };
  } catch (erro) {
    const mensagem = mensagemSegura(erro);

    await repositorio.concluirExecucao(execucaoId, {
      status: 'error',
      recebidos: 0,
      novas: 0,
      atualizadas: 0,
      descartados: 0,
      erro: mensagem,
    });

    const falhas = await repositorio.registrarFalha(fonte.id, mensagem);
    if (falhas >= LIMITE_FALHAS_CONSECUTIVAS) {
      await repositorio.desativarFonte(fonte.id);
      registrar('ingestao.fonte_desativada', { fonte: fonte.nome, falhas });
    }

    registrar('ingestao.fonte_erro', { fonte: fonte.nome, erro: mensagem, falhas });
    return resumoVazio(fonte.nome, 'erro', mensagem);
  }
}

function resumoVazio(
  fonte: string,
  status: ResumoFonte['status'],
  erro: string | null,
): ResumoFonte {
  return { fonte, status, recebidos: 0, novas: 0, atualizadas: 0, descartados: 0, erro };
}
