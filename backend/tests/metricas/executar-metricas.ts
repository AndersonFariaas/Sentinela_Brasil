/**
 * Executa o conjunto rotulado pelo pipeline real e grava o relatório em docs/metricas/.
 * Uso: npm run metricas (a partir da pasta backend).
 *
 * A reputação vem da própria fixture, então as métricas medem as regras do motor sobre
 * dados sintéticos. Não medem a qualidade das fontes reais nem as integrações.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { platform } from 'node:os';
import { z } from 'zod';
import { analisarUrl } from '../../src/modules/scanner/analisador.js';
import {
  type AmostraAvaliada,
  calcularMetricas,
  type MetricasMotor,
} from '../../src/modules/scanner/metricas.js';
import { REGRAS_RISCO } from '../../src/modules/scanner/regras.js';
import type {
  CandidatoReputacao,
  RepositorioScans,
} from '../../src/modules/scanner/repositorio.js';
import type { CorrespondenciaReputacao } from '../../src/modules/scanner/tipos.js';
import { validarUrlEntrada } from '../../src/modules/scanner/validacao.js';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

// Data fixa: a janela de recência é contada a partir deste ponto, então o relatório é reproduzível.
const AGORA = new Date('2026-11-02T12:00:00.000Z');
const TOKEN_DE_TESTE = 'token-de-teste-sem-usuario-real';

const CATEGORIAS_RECUSADAS = new Set(['invalida', 'privada']);

const reputacaoSchema = z.object({
  tipo: z.enum(['url', 'domain', 'ip']),
  valor: z.string().min(1),
  fonte: z.string().min(1),
  confiabilidade: z.number().int().min(1).max(5),
  diasDesdeUltimaVez: z.number().int().nonnegative(),
});

const casoSchema = z.object({
  id: z.string().min(1),
  categoria: z.enum([
    'legitima',
    'suspeita_estrutural',
    'reputacao',
    'redirecionamento',
    'invalida',
    'privada',
  ]),
  url: z.string(),
  perigosa: z.boolean(),
  justificativa: z.string().min(1),
  motivoEsperado: z.enum(['formato', 'protocolo', 'credenciais', 'interno']).optional(),
  reputacao: z.array(reputacaoSchema).optional(),
});

const fixtureSchema = z.object({
  versao: z.string().min(1),
  descricao: z.string().min(1),
  casos: z.array(casoSchema).min(1),
});

type Caso = z.infer<typeof casoSchema>;

const CAMINHO_FIXTURE = new URL('../fixtures/urls-rotuladas.json', import.meta.url);
const CAMINHO_RELATORIO = new URL('../../../docs/metricas/relatorio-motor.md', import.meta.url);

/** Repositório em memória que responde com a reputação declarada no caso, como o banco faria. */
function repositorioDoCaso(caso: Caso): Pick<RepositorioScans, 'buscarCorrespondencias'> {
  const correspondencias: CorrespondenciaReputacao[] = (caso.reputacao ?? []).map((r) => ({
    tipo: r.tipo,
    valor: r.valor,
    fonte: r.fonte,
    confiabilidade: r.confiabilidade,
    ultimaVez: new Date(AGORA.getTime() - r.diasDesdeUltimaVez * MS_POR_DIA),
  }));

  return {
    buscarCorrespondencias(_token: string, candidatos: CandidatoReputacao[]) {
      const achados = correspondencias.filter((c) =>
        candidatos.some((k) => k.tipo === c.tipo && k.valor === c.valor),
      );
      return Promise.resolve(achados);
    },
  };
}

async function avaliarCaso(caso: Caso): Promise<AmostraAvaliada> {
  const deveRecusar = CATEGORIAS_RECUSADAS.has(caso.categoria);
  const inicio = performance.now();

  const validacao = validarUrlEntrada(caso.url);
  if (!validacao.ok) {
    return {
      perigosa: caso.perigosa,
      deveRecusar,
      recusada: true,
      motivoCorreto: validacao.motivo === caso.motivoEsperado,
      classificacao: null,
      tempoMs: null,
    };
  }

  const resultado = await analisarUrl(
    { normalizada: validacao.normalizada, host: validacao.host },
    repositorioDoCaso(caso),
    TOKEN_DE_TESTE,
    REGRAS_RISCO,
    AGORA,
  );

  return {
    perigosa: caso.perigosa,
    deveRecusar,
    recusada: false,
    motivoCorreto: true,
    classificacao: resultado.classificacao,
    tempoMs: performance.now() - inicio,
  };
}

function formatarTaxa(valor: number | null): string {
  return valor === null ? 'sem base' : `${(valor * 100).toFixed(1)}%`;
}

function formatarTempo(valor: number | null): string {
  return valor === null ? '—' : `${valor.toFixed(2)} ms`;
}

function linhasPorCategoria(casos: Caso[], amostras: AmostraAvaliada[]): string[] {
  const categorias = [...new Set(casos.map((caso) => caso.categoria))];

  return categorias.map((categoria) => {
    const doGrupo = amostras.filter((_, i) => casos[i]?.categoria === categoria);
    const recusados = doGrupo.filter((a) => a.recusada).length;
    const positivos = doGrupo.filter(
      (a) => !a.recusada && (a.classificacao === 'suspeito' || a.classificacao === 'confirmado'),
    ).length;
    return `| ${categoria} | ${String(doGrupo.length)} | ${String(recusados)} | ${String(positivos)} |`;
  });
}

/** Lista os IDs dos casos que caíram em cada erro, para a revisão olhar caso a caso. */
function idsDoErro(
  casos: Caso[],
  amostras: AmostraAvaliada[],
  erro: (amostra: AmostraAvaliada) => boolean,
): string {
  const ids = casos.filter((_, i) => {
    const amostra = amostras[i];
    return amostra !== undefined && erro(amostra);
  });
  return ids.length === 0 ? 'nenhum' : ids.map((caso) => `\`${caso.id}\``).join(', ');
}

function montarRelatorio(
  metricas: MetricasMotor,
  casos: Caso[],
  amostras: AmostraAvaliada[],
  versaoFixture: string,
): string {
  return [
    '# Métricas do motor de risco',
    '',
    '> Gerado por `npm run metricas` (pasta backend). Não edite à mão: rode de novo para atualizar.',
    '',
    '## Como ler',
    '',
    `- **Conjunto:** ${String(metricas.total)} URLs rotuladas (fixture versão ${versaoFixture}), em \`backend/tests/fixtures/urls-rotuladas.json\`.`,
    `- **Motor:** \`risk-rules.json\` versão ${REGRAS_RISCO.versao}.`,
    '- **Reputação:** sintética, declarada em cada caso. Os números medem as regras do motor, não a qualidade de fontes reais.',
    '- **Integrações:** a taxa de falha de Firecrawl, URLhaus e IA **não foi medida**. Esta execução roda sem rede e sem chaves.',
    '- **Tempo:** medido nesta máquina, sem rede. Serve para comparar execuções, não como promessa de desempenho.',
    `- **Ambiente:** Node ${process.version}, ${platform()}.`,
    '',
    '## Validação (recusas)',
    '',
    '| Medida | Valor |',
    '| --- | --- |',
    `| Recusadas corretamente | ${String(metricas.recusasCorretas)} |`,
    `| Recusadas indevidamente (deviam ser analisadas) | ${String(metricas.recusasIndevidas)} |`,
    `| Aceitas indevidamente (deviam ser recusadas) | ${String(metricas.aceitasIndevidamente)} |`,
    `| Recusadas com motivo diferente do esperado | ${String(metricas.recusasComMotivoDiferente)} |`,
    '',
    '## Classificação (URLs analisadas)',
    '',
    `Analisadas: ${String(metricas.analisadas)}. Positivo = classificação \`suspeito\` ou \`confirmado\`.`,
    '',
    '| Medida | Valor |',
    '| --- | --- |',
    `| Verdadeiros positivos | ${String(metricas.verdadeirosPositivos)} |`,
    `| Falsos positivos | ${String(metricas.falsosPositivos)} |`,
    `| Verdadeiros negativos | ${String(metricas.verdadeirosNegativos)} |`,
    `| Falsos negativos | ${String(metricas.falsosNegativos)} |`,
    `| Precisão | ${formatarTaxa(metricas.precisao)} |`,
    `| Recall | ${formatarTaxa(metricas.recall)} |`,
    `| Taxa de falsos positivos | ${formatarTaxa(metricas.taxaFalsoPositivo)} |`,
    `| Acurácia | ${formatarTaxa(metricas.acuracia)} |`,
    `| Tempo mediano por análise | ${formatarTempo(metricas.tempoMedianoMs)} |`,
    `| Tempo máximo por análise | ${formatarTempo(metricas.tempoMaximoMs)} |`,
    '',
    '## Erros por caso',
    '',
    `- **Falsos positivos:** ${idsDoErro(casos, amostras, (a) => !a.recusada && !a.perigosa && (a.classificacao === 'suspeito' || a.classificacao === 'confirmado'))}`,
    `- **Falsos negativos:** ${idsDoErro(casos, amostras, (a) => !a.recusada && a.perigosa && a.classificacao === 'nao_identificado')}`,
    `- **Aceitas indevidamente:** ${idsDoErro(casos, amostras, (a) => !a.recusada && a.deveRecusar)}`,
    '',
    '## Por categoria',
    '',
    '| Categoria | Casos | Recusados | Marcados como suspeitos ou confirmados |',
    '| --- | --- | --- | --- |',
    ...linhasPorCategoria(casos, amostras),
    '',
    '## Limites',
    '',
    '- O conjunto é pequeno e foi feito por uma pessoa. Serve para regressão e para discutir o motor, não para afirmar eficácia em produção.',
    '- Os rótulos são julgamento de analista, escritos antes desta execução. Podem ser discutidos.',
    '- Falsos negativos são sinais que o motor não pontua. Por exemplo, uma palavra de isca sozinha não chega ao limiar de suspeito. Mudar isso exige decidir o peso das regras, o que não é feito aqui.',
    '',
  ].join('\n');
}

async function main(): Promise<void> {
  const fixture = fixtureSchema.parse(JSON.parse(await readFile(CAMINHO_FIXTURE, 'utf8')));

  const amostras: AmostraAvaliada[] = [];
  for (const caso of fixture.casos) {
    amostras.push(await avaliarCaso(caso));
  }

  const metricas = calcularMetricas(amostras);
  await mkdir(new URL('.', CAMINHO_RELATORIO), { recursive: true });
  await writeFile(
    CAMINHO_RELATORIO,
    montarRelatorio(metricas, fixture.casos, amostras, fixture.versao),
    'utf8',
  );

  process.stdout.write(
    `Métricas gravadas em docs/metricas/relatorio-motor.md (${String(metricas.total)} URLs).\n` +
      `Precisão: ${formatarTaxa(metricas.precisao)} · Recall: ${formatarTaxa(metricas.recall)} · ` +
      `Falsos positivos: ${String(metricas.falsosPositivos)} · Falsos negativos: ${String(metricas.falsosNegativos)} · ` +
      `Aceitas indevidamente: ${String(metricas.aceitasIndevidamente)}\n`,
  );
}

main().catch((erro: unknown) => {
  const motivo = erro instanceof Error ? erro.message : 'erro desconhecido';
  process.stderr.write(`Falha ao executar as métricas: ${motivo}\n`);
  process.exitCode = 1;
});
