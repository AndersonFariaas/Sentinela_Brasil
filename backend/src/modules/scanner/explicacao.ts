import type { RegrasRisco } from './regras.js';
import type { Classificacao, Evidencia, Explicacao, NivelRisco } from './tipos.js';

const RESUMOS: Record<Classificacao, string> = {
  confirmado: 'Esta URL corresponde a um indicador de ameaça de fonte confiável.',
  suspeito: 'A URL apresenta sinais de risco. Isso pede cautela, mas não confirma uma fraude.',
  nao_identificado: 'Não encontramos sinais de risco nas fontes e regras disponíveis.',
};

const RECOMENDACOES_BASE = [
  'Não informe senhas, códigos de verificação ou dados de cartão neste endereço.',
  'Para acessar um serviço, digite o endereço oficial manualmente ou use o aplicativo.',
];

const RECOMENDACOES_POR_CLASSIFICACAO: Record<Classificacao, string> = {
  confirmado:
    'Não abra o link. Se já informou dados, troque as senhas afetadas e avise o banco ou a equipe de segurança.',
  suspeito: 'Confirme a mensagem ou o site pelo canal oficial antes de agir.',
  nao_identificado:
    'A ausência de registro não confirma que o endereço é legítimo. A base de reputação ainda é limitada.',
};

interface DadosExplicacao {
  classificacao: Classificacao;
  nivel: NivelRisco;
  pontuacao: number;
  evidencias: Evidencia[];
}

function justificar(
  { nivel, pontuacao, evidencias }: DadosExplicacao,
  regras: RegrasRisco,
): string {
  const base = `Pontuação ${String(pontuacao)} de 100 (nível ${nivel}).`;

  if (evidencias.length === 0) {
    return `${base} Nenhum sinal foi encontrado. Isso mostra falta de informação, não segurança.`;
  }

  const reputacao = evidencias.filter((evidencia) => evidencia.grupo === 'R');
  const estrutura = evidencias.filter((evidencia) => evidencia.grupo === 'E');

  const trechoReputacao =
    reputacao.length > 0
      ? `Há ${String(reputacao.length)} correspondência(s) em fontes de reputação.`
      : `Nenhuma correspondência em fontes de reputação. Sem ela, a pontuação fica limitada a ${String(regras.incerteza.tetoSemReputacao)}.`;

  const trechoEstrutura =
    estrutura.length > 0
      ? `Sinais estruturais: ${estrutura.map((evidencia) => evidencia.titulo.toLowerCase()).join('; ')}.`
      : 'Nenhum sinal estrutural foi encontrado.';

  return `${base} ${trechoReputacao} ${trechoEstrutura}`;
}

/**
 * Explicação montada a partir das regras, sem IA. É o fallback do AI Analyst (Fase 6).
 * O texto cita só o que o motor calculou, então não inventa fatos.
 */
export function gerarExplicacao(dados: DadosExplicacao, regras: RegrasRisco): Explicacao {
  return {
    resumo: RESUMOS[dados.classificacao],
    justificativa: justificar(dados, regras),
    recomendacoes: [...RECOMENDACOES_BASE, RECOMENDACOES_POR_CLASSIFICACAO[dados.classificacao]],
  };
}
