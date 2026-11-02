import { ErroEnvioEmail, type MensagemEmail, type ProvedorEmail } from './envio.js';
import type { AlertaPendente, RepositorioAlertas } from './repositorio.js';
import { montarEmailAlerta } from './template.js';

/** Número total de tentativas por alerta, contando a primeira. Passou disso, o alerta vira falha. */
export const TENTATIVAS_MAXIMAS = 3;

/** A coleta roda uma vez por dia. A janela cobre uma execução com falha sem perder ameaças. */
export const JANELA_ALERTA_HORAS = 48;

const LOTE_ENVIO = 100;
const ESPERA_BASE_MS = 2000;
const MENSAGEM_FALHA_GENERICA = 'Falha inesperada no envio.';

export interface ResumoAlertas {
  ameacas: number;
  criados: number;
  enviados: number;
  falhas: number;
}

export interface OpcoesAlertas {
  provedor: ProvedorEmail;
  agora: Date;
  registrar: (evento: string, dados: Record<string, unknown>) => void;
  esperar?: (ms: number) => Promise<void>;
}

const esperarPadrao = (ms: number): Promise<void> =>
  new Promise((resolver) => setTimeout(resolver, ms));

/** Erros do provedor com mensagem própria são seguros. Qualquer outro vira mensagem genérica. */
function classificarErro(erro: unknown): { temporario: boolean; mensagem: string } {
  if (erro instanceof ErroEnvioEmail) {
    return { temporario: erro.temporario, mensagem: erro.message };
  }

  // Erro desconhecido pode ser transitório, então tenta de novo. A mensagem original não é gravada.
  return { temporario: true, mensagem: MENSAGEM_FALHA_GENERICA };
}

/**
 * Cria os alertas das ameaças verificadas recentes e envia os pendentes.
 * Rodar duas vezes não duplica: a chave única no banco impede a criação e a chave de
 * idempotência impede o reenvio do mesmo alerta.
 */
export async function dispararAlertas(
  repositorio: RepositorioAlertas,
  opcoes: OpcoesAlertas,
): Promise<ResumoAlertas> {
  const esperar = opcoes.esperar ?? esperarPadrao;
  const desde = new Date(opcoes.agora.getTime() - JANELA_ALERTA_HORAS * 60 * 60 * 1000);
  const ameacas = await repositorio.buscarAmeacasConfirmadas(desde.toISOString());

  let criados = 0;
  for (const ameaca of ameacas) {
    const inscritos = await repositorio.buscarInscritos(ameaca.categoria);
    if (inscritos.length > 0) {
      criados += await repositorio.criarAlertas(ameaca.id, inscritos);
    }
  }

  const pendentes = await repositorio.listarAlertasPendentes(LOTE_ENVIO, TENTATIVAS_MAXIMAS);
  let enviados = 0;
  let falhas = 0;

  for (const alerta of pendentes) {
    const mensagem = montarEmailAlerta(alerta.ameaca, alerta.destinatario);
    const resultado = await enviarComTentativas(repositorio, opcoes, esperar, alerta, mensagem);

    if (resultado === 'enviado') {
      enviados += 1;
    } else {
      falhas += 1;
    }
  }

  opcoes.registrar('alertas.resumo', { ameacas: ameacas.length, criados, enviados, falhas });
  return { ameacas: ameacas.length, criados, enviados, falhas };
}

async function enviarComTentativas(
  repositorio: RepositorioAlertas,
  opcoes: OpcoesAlertas,
  esperar: (ms: number) => Promise<void>,
  alerta: AlertaPendente,
  mensagem: MensagemEmail,
): Promise<'enviado' | 'falhou'> {
  let tentativas = alerta.tentativas;

  while (tentativas < TENTATIVAS_MAXIMAS) {
    tentativas += 1;

    let messageId: string;
    try {
      messageId = await opcoes.provedor.enviar(mensagem, alerta.chaveIdempotencia);
    } catch (erro) {
      const { temporario, mensagem: motivo } = classificarErro(erro);

      if (temporario && tentativas < TENTATIVAS_MAXIMAS) {
        opcoes.registrar('alertas.nova_tentativa', {
          alerta: alerta.id,
          tentativa: tentativas,
          motivo,
        });
        await esperar(ESPERA_BASE_MS * tentativas);
        continue;
      }

      await repositorio.registrarFalha(alerta.id, tentativas, motivo);
      opcoes.registrar('alertas.falha', { alerta: alerta.id, tentativas, motivo });
      return 'falhou';
    }

    // Fora do try: se a gravação falhar, o erro sobe. Não deve virar nova tentativa de envio.
    await repositorio.registrarEnvio(alerta.id, messageId, tentativas);
    opcoes.registrar('alertas.enviado', { alerta: alerta.id, tentativas });
    return 'enviado';
  }

  // Só chega aqui se o alerta já tinha esgotado as tentativas antes desta execução.
  return 'falhou';
}
