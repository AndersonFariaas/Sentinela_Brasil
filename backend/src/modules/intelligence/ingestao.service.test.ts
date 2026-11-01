import { describe, expect, it, vi, type Mock } from 'vitest';
import { ErroColeta } from './erros.js';
import {
  LIMITE_FALHAS_CONSECUTIVAS,
  executarIngestao,
  type RepositorioIngestao,
} from './ingestao.service.js';
import type { AdaptadorFonte, FonteAtiva } from './tipos.js';

const FONTE: FonteAtiva = {
  id: '22222222-2222-4222-8222-222222222222',
  nome: 'CISA KEV',
  tipo: 'feed_json',
  urlBase: 'https://www.cisa.gov/feed.json',
  confiabilidade: 5,
};

// Mocks guardados como propriedades (não como métodos) para que as asserções os referenciem sem ressalvas.
function repositorioFalso(sobrescrever: Partial<Record<keyof RepositorioIngestao, Mock>> = {}) {
  return {
    listarFontesAtivas: sobrescrever.listarFontesAtivas ?? vi.fn().mockResolvedValue([FONTE]),
    iniciarExecucao: sobrescrever.iniciarExecucao ?? vi.fn().mockResolvedValue('execucao-1'),
    salvarAmeacas:
      sobrescrever.salvarAmeacas ?? vi.fn().mockResolvedValue({ novas: 2, atualizadas: 1 }),
    concluirExecucao: sobrescrever.concluirExecucao ?? vi.fn().mockResolvedValue(undefined),
    registrarSucesso: sobrescrever.registrarSucesso ?? vi.fn().mockResolvedValue(undefined),
    registrarFalha: sobrescrever.registrarFalha ?? vi.fn().mockResolvedValue(1),
    desativarFonte: sobrescrever.desativarFonte ?? vi.fn().mockResolvedValue(undefined),
  };
}

function adaptadorQue(coletar: AdaptadorFonte['coletar']): AdaptadorFonte {
  return { coletar };
}

const registrar = vi.fn();

describe('executarIngestao', () => {
  it('grava as ameaças coletadas e registra a execução como ok', async () => {
    const repo = repositorioFalso();
    const adaptador = adaptadorQue(() =>
      Promise.resolve({ ameacas: [{} as never, {} as never, {} as never], descartados: 1 }),
    );

    const [resumo] = await executarIngestao(repo, () => adaptador, registrar);

    expect(resumo).toEqual({
      fonte: 'CISA KEV',
      status: 'ok',
      recebidos: 3,
      novas: 2,
      atualizadas: 1,
      descartados: 1,
      erro: null,
    });
    expect(repo.concluirExecucao).toHaveBeenCalledWith(
      'execucao-1',
      expect.objectContaining({ status: 'ok', recebidos: 3 }),
    );
    expect(repo.registrarSucesso).toHaveBeenCalledWith(FONTE.id);
  });

  it('registra o erro seguro quando o adaptador falha, sem contar como sucesso', async () => {
    const repo = repositorioFalso();
    const adaptador = adaptadorQue(() =>
      Promise.reject(new ErroColeta('A fonte respondeu com HTTP 503.')),
    );

    const [resumo] = await executarIngestao(repo, () => adaptador, registrar);

    expect(resumo?.status).toBe('erro');
    expect(repo.concluirExecucao).toHaveBeenCalledWith(
      'execucao-1',
      expect.objectContaining({ status: 'error', erro: 'A fonte respondeu com HTTP 503.' }),
    );
    expect(repo.registrarSucesso).not.toHaveBeenCalled();
    expect(repo.registrarFalha).toHaveBeenCalledWith(FONTE.id, 'A fonte respondeu com HTTP 503.');
  });

  it('não expõe detalhe de erro inesperado, só mensagem genérica', async () => {
    const repo = repositorioFalso();
    const adaptador = adaptadorQue(() => Promise.reject(new Error('detalhe interno sensível')));

    const [resumo] = await executarIngestao(repo, () => adaptador, registrar);

    expect(resumo?.erro).toBe('Falha inesperada na coleta.');
    expect(repo.registrarFalha).toHaveBeenCalledWith(FONTE.id, 'Falha inesperada na coleta.');
  });

  it('desativa a fonte ao atingir o limite de falhas seguidas', async () => {
    const repo = repositorioFalso({
      registrarFalha: vi.fn().mockResolvedValue(LIMITE_FALHAS_CONSECUTIVAS),
    });
    const adaptador = adaptadorQue(() => Promise.reject(new ErroColeta('falha')));

    await executarIngestao(repo, () => adaptador, registrar);

    expect(repo.desativarFonte).toHaveBeenCalledWith(FONTE.id);
  });

  it('não desativa a fonte antes do limite', async () => {
    const repo = repositorioFalso({
      registrarFalha: vi.fn().mockResolvedValue(LIMITE_FALHAS_CONSECUTIVAS - 1),
    });
    const adaptador = adaptadorQue(() => Promise.reject(new ErroColeta('falha')));

    await executarIngestao(repo, () => adaptador, registrar);

    expect(repo.desativarFonte).not.toHaveBeenCalled();
  });

  it('ignora fonte sem adaptador, sem contar como falha', async () => {
    const repo = repositorioFalso();

    const [resumo] = await executarIngestao(repo, () => undefined, registrar);

    expect(resumo?.status).toBe('ignorada');
    expect(repo.iniciarExecucao).not.toHaveBeenCalled();
    expect(repo.registrarFalha).not.toHaveBeenCalled();
  });

  it('uma fonte com erro não impede a coleta das demais', async () => {
    const outra: FonteAtiva = {
      ...FONTE,
      id: '33333333-3333-4333-8333-333333333333',
      nome: 'Outra',
    };
    const repo = repositorioFalso({
      listarFontesAtivas: vi.fn().mockResolvedValue([FONTE, outra]),
    });
    const ruim = adaptadorQue(() => Promise.reject(new ErroColeta('falha')));
    const boa = adaptadorQue(() => Promise.resolve({ ameacas: [], descartados: 0 }));

    const resumos = await executarIngestao(
      repo,
      (fonte) => (fonte.id === FONTE.id ? ruim : boa),
      registrar,
    );

    expect(resumos.map((r) => r.status)).toEqual(['erro', 'ok']);
  });
});
