import { isIP } from 'node:net';
import { avaliarEstrutura } from './heuristicas.js';
import { gerarExplicacao } from './explicacao.js';
import { avaliarRisco } from './motor.js';
import type { RegrasRisco } from './regras.js';
import type { CandidatoReputacao, RepositorioScans } from './repositorio.js';
import type { CorrespondenciaReputacao, FonteConsultada, ResultadoAnalise } from './tipos.js';

const NOME_FONTE_LOCAL = 'Indicadores coletados';

/**
 * Candidatos de reputação: a URL exata, o host e os domínios pais.
 * Assim, um indicador "exemplo.com" também pega "login.exemplo.com".
 */
export function gerarCandidatos(host: string, normalizada: string): CandidatoReputacao[] {
  const candidatos: CandidatoReputacao[] = [{ tipo: 'url', valor: normalizada }];

  if (isIP(host) !== 0) {
    return [...candidatos, { tipo: 'ip', valor: host }];
  }

  const rotulos = host.split('.');
  // Para no segundo rótulo: "com" sozinho não é um domínio útil para consulta.
  for (let inicio = 0; inicio <= rotulos.length - 2; inicio += 1) {
    candidatos.push({ tipo: 'domain', valor: rotulos.slice(inicio).join('.') });
  }

  return candidatos;
}

function montarFontes(correspondencias: CorrespondenciaReputacao[]): FonteConsultada[] {
  const porFonte = new Map<string, number>();
  for (const { fonte } of correspondencias) {
    porFonte.set(fonte, (porFonte.get(fonte) ?? 0) + 1);
  }

  if (porFonte.size === 0) {
    return [{ nome: NOME_FONTE_LOCAL, status: 'consultada', correspondencias: 0 }];
  }

  return [...porFonte].map(([nome, quantidade]) => ({
    nome,
    status: 'consultada',
    correspondencias: quantidade,
  }));
}

interface EntradaAnalise {
  normalizada: string;
  host: string;
}

/**
 * Pipeline de análise depois da validação: heurísticas, reputação, motor e explicação.
 * Nenhuma etapa acessa a URL analisada.
 */
export async function analisarUrl(
  entrada: EntradaAnalise,
  repositorio: Pick<RepositorioScans, 'buscarCorrespondencias'>,
  accessToken: string,
  regras: RegrasRisco,
  agora: Date = new Date(),
): Promise<ResultadoAnalise> {
  const { normalizada, host } = entrada;

  const candidatos = gerarCandidatos(host, normalizada);
  const correspondencias = await repositorio.buscarCorrespondencias(accessToken, candidatos);

  const estruturais = avaliarEstrutura(new URL(normalizada), host, regras);
  const avaliacao = avaliarRisco(correspondencias, estruturais, agora, regras);

  return {
    classificacao: avaliacao.classificacao,
    pontuacao: avaliacao.pontuacao,
    nivel: avaliacao.nivel,
    evidencias: avaliacao.evidencias,
    fontes: montarFontes(correspondencias),
    explicacao: gerarExplicacao(avaliacao, regras),
  };
}
