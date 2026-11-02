import { describe, expect, it, vi } from 'vitest';
import { executarLimpeza, type RepositorioRetencao } from './limpeza.service.js';
import { limiteDeRetencao, REGRAS_RETENCAO, type RegraRetencao } from './politica.js';

const AGORA = new Date('2026-11-02T12:00:00.000Z');
const DIA_EM_MS = 24 * 60 * 60 * 1000;

function repositorioFalso(contagem = 2) {
  const contarAnteriores = vi
    .fn<RepositorioRetencao['contarAnteriores']>()
    .mockResolvedValue(contagem);
  const removerAnteriores = vi
    .fn<RepositorioRetencao['removerAnteriores']>()
    .mockResolvedValue(contagem);
  const registrarLimpeza = vi
    .fn<RepositorioRetencao['registrarLimpeza']>()
    .mockResolvedValue(undefined);

  return {
    repositorio: { contarAnteriores, removerAnteriores, registrarLimpeza },
    contarAnteriores,
    removerAnteriores,
    registrarLimpeza,
  };
}

describe('limiteDeRetencao', () => {
  it('recua o número de dias a partir de agora', () => {
    expect(limiteDeRetencao(AGORA, 180).getTime()).toBe(AGORA.getTime() - 180 * DIA_EM_MS);
  });
});

describe('REGRAS_RETENCAO', () => {
  it('segue os prazos de database.md §6', () => {
    const prazos = Object.fromEntries(REGRAS_RETENCAO.map((r) => [r.tabela, r.diasRetencao]));

    expect(prazos).toEqual({ scans: 180, alerts: 180, ingestion_runs: 90, audit_log: 365 });
  });

  it('não inclui ameaças nem indicadores, que são a base de inteligência', () => {
    const tabelas: string[] = REGRAS_RETENCAO.map((r) => r.tabela);

    expect(tabelas).not.toContain('threats');
    expect(tabelas).not.toContain('indicators');
  });
});

describe('executarLimpeza', () => {
  it('sem executar, só conta e não apaga nem grava nada', async () => {
    const { repositorio, removerAnteriores, registrarLimpeza } = repositorioFalso(3);

    const resumo = await executarLimpeza(repositorio, AGORA, false);

    expect(resumo).toEqual({
      executada: false,
      porTabela: { scans: 3, alerts: 3, ingestion_runs: 3, audit_log: 3 },
    });
    expect(removerAnteriores).not.toHaveBeenCalled();
    expect(registrarLimpeza).not.toHaveBeenCalled();
  });

  it('executando, apaga cada tabela com o limite do prazo e registra na auditoria', async () => {
    const { repositorio, removerAnteriores, registrarLimpeza } = repositorioFalso(5);

    const resumo = await executarLimpeza(repositorio, AGORA, true);

    expect(resumo.executada).toBe(true);
    expect(removerAnteriores).toHaveBeenCalledTimes(REGRAS_RETENCAO.length);

    const [regra, limite] = removerAnteriores.mock.calls[0] ?? [];
    expect(regra?.tabela).toBe('scans');
    expect(limite?.getTime()).toBe(AGORA.getTime() - 180 * DIA_EM_MS);

    expect(registrarLimpeza).toHaveBeenCalledWith({
      scans: 5,
      alerts: 5,
      ingestion_runs: 5,
      audit_log: 5,
    });
  });

  it('usa as regras passadas quando são diferentes das padrão', async () => {
    const { repositorio, contarAnteriores } = repositorioFalso(1);
    const regraUnica: RegraRetencao = {
      tabela: 'scans',
      colunaData: 'created_at',
      diasRetencao: 30,
    };

    const resumo = await executarLimpeza(repositorio, AGORA, false, [regraUnica]);

    expect(resumo.porTabela).toEqual({ scans: 1 });
    expect(contarAnteriores).toHaveBeenCalledWith(
      regraUnica,
      new Date(AGORA.getTime() - 30 * DIA_EM_MS),
    );
  });
});
