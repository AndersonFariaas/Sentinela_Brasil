import { describe, expect, it, vi, type Mock } from 'vitest';
import { ErroEnvioEmail, type ProvedorEmail } from './envio.js';
import { dispararAlertas, JANELA_ALERTA_HORAS, TENTATIVAS_MAXIMAS } from './alertas.service.js';
import type { AlertaPendente, RepositorioAlertas } from './repositorio.js';
import type { AmeacaAlerta } from './template.js';

const AGORA = new Date('2026-11-02T12:00:00.000Z');
const CHAVE_ALERTA =
  'alert:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222:nova_ameaca';

const AMEACA: AmeacaAlerta = {
  id: '22222222-2222-4222-8222-222222222222',
  titulo: 'CVE-2026-0001: Falha em servidor',
  descricao: 'Vulnerabilidade explorada em campanhas.',
  categoria: 'exploited_vulnerability',
  severidade: 'critico',
  cveId: 'CVE-2026-0001',
  urlFonte: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
};

function alertaPendente(sobrescrever: Partial<AlertaPendente> = {}): AlertaPendente {
  return {
    id: 'alerta-1',
    chaveIdempotencia: CHAVE_ALERTA,
    tentativas: 0,
    destinatario: 'pessoa@exemplo.com',
    ameaca: AMEACA,
    ...sobrescrever,
  };
}

// Mocks guardados como propriedades para que as asserções os referenciem sem ressalvas.
function repositorioFalso(sobrescrever: Partial<Record<keyof RepositorioAlertas, Mock>> = {}) {
  return {
    buscarAmeacasConfirmadas:
      sobrescrever.buscarAmeacasConfirmadas ?? vi.fn().mockResolvedValue([AMEACA]),
    buscarInscritos: sobrescrever.buscarInscritos ?? vi.fn().mockResolvedValue(['usuario-1']),
    criarAlertas: sobrescrever.criarAlertas ?? vi.fn().mockResolvedValue(1),
    listarAlertasPendentes:
      sobrescrever.listarAlertasPendentes ?? vi.fn().mockResolvedValue([alertaPendente()]),
    registrarEnvio: sobrescrever.registrarEnvio ?? vi.fn().mockResolvedValue(undefined),
    registrarFalha: sobrescrever.registrarFalha ?? vi.fn().mockResolvedValue(undefined),
  };
}

function provedorFalso(enviar: Mock): ProvedorEmail {
  return { enviar: enviar as ProvedorEmail['enviar'] };
}

const registrar = vi.fn();
const esperar = vi.fn().mockResolvedValue(undefined);

function opcoes(provedor: ProvedorEmail) {
  return { provedor, agora: AGORA, registrar, esperar };
}

describe('dispararAlertas', () => {
  it('cria um alerta por inscrito e envia cada um com a chave de idempotência do alerta', async () => {
    const enviar = vi.fn().mockResolvedValue('msg-1');
    const repo = repositorioFalso({
      listarAlertasPendentes: vi.fn().mockResolvedValue([alertaPendente()]),
    });

    const resumo = await dispararAlertas(repo, opcoes(provedorFalso(enviar)));

    expect(repo.criarAlertas).toHaveBeenCalledWith(AMEACA.id, ['usuario-1']);
    expect(enviar).toHaveBeenCalledWith(
      expect.objectContaining({ para: 'pessoa@exemplo.com' }),
      CHAVE_ALERTA,
    );
    expect(repo.registrarEnvio).toHaveBeenCalledWith('alerta-1', 'msg-1', 1);
    expect(resumo).toEqual({ ameacas: 1, criados: 1, enviados: 1, falhas: 0 });
  });

  it('não cria alertas quando ninguém está inscrito na categoria', async () => {
    const repo = repositorioFalso({ buscarInscritos: vi.fn().mockResolvedValue([]) });

    const resumo = await dispararAlertas(repo, opcoes(provedorFalso(vi.fn())));

    expect(repo.criarAlertas).not.toHaveBeenCalled();
    expect(resumo.criados).toBe(0);
  });

  it('busca só ameaças dentro da janela de horas antes de agora', async () => {
    const repo = repositorioFalso();

    await dispararAlertas(repo, opcoes(provedorFalso(vi.fn().mockResolvedValue('msg'))));

    const desde = new Date(AGORA.getTime() - JANELA_ALERTA_HORAS * 60 * 60 * 1000);
    expect(repo.buscarAmeacasConfirmadas).toHaveBeenCalledWith(desde.toISOString());
  });

  it('tenta de novo após erro temporário, com a mesma chave de idempotência', async () => {
    const enviar = vi
      .fn()
      .mockRejectedValueOnce(new ErroEnvioEmail(true, 'Limite de envio atingido.'))
      .mockResolvedValueOnce('msg-2');
    const repo = repositorioFalso({
      listarAlertasPendentes: vi.fn().mockResolvedValue([alertaPendente()]),
    });

    await dispararAlertas(repo, opcoes(provedorFalso(enviar)));

    expect(enviar).toHaveBeenCalledTimes(2);
    expect(enviar.mock.calls[0]?.[1]).toBe(CHAVE_ALERTA);
    expect(enviar.mock.calls[1]?.[1]).toBe(CHAVE_ALERTA);
    expect(esperar).toHaveBeenCalledWith(2000);
    expect(repo.registrarEnvio).toHaveBeenCalledWith('alerta-1', 'msg-2', 2);
  });

  it('não tenta de novo após erro definitivo e grava a mensagem segura', async () => {
    const enviar = vi
      .fn()
      .mockRejectedValue(new ErroEnvioEmail(false, 'Chave da Resend inválida.'));
    const repo = repositorioFalso({
      listarAlertasPendentes: vi.fn().mockResolvedValue([alertaPendente()]),
    });

    const resumo = await dispararAlertas(repo, opcoes(provedorFalso(enviar)));

    expect(enviar).toHaveBeenCalledTimes(1);
    expect(repo.registrarFalha).toHaveBeenCalledWith('alerta-1', 1, 'Chave da Resend inválida.');
    expect(resumo.falhas).toBe(1);
  });

  it('esgota as tentativas máximas e marca falha', async () => {
    const enviar = vi.fn().mockRejectedValue(new ErroEnvioEmail(true, 'Serviço indisponível.'));
    const repo = repositorioFalso({
      listarAlertasPendentes: vi.fn().mockResolvedValue([alertaPendente()]),
    });

    await dispararAlertas(repo, opcoes(provedorFalso(enviar)));

    expect(enviar).toHaveBeenCalledTimes(TENTATIVAS_MAXIMAS);
    expect(repo.registrarFalha).toHaveBeenCalledWith(
      'alerta-1',
      TENTATIVAS_MAXIMAS,
      'Serviço indisponível.',
    );
  });

  it('erro inesperado é transitório e não grava a mensagem original', async () => {
    const enviar = vi.fn().mockRejectedValue(new Error('segredo re_123 vazado'));
    const repo = repositorioFalso({
      listarAlertasPendentes: vi.fn().mockResolvedValue([alertaPendente()]),
    });

    await dispararAlertas(repo, opcoes(provedorFalso(enviar)));

    expect(enviar).toHaveBeenCalledTimes(TENTATIVAS_MAXIMAS);
    expect(repo.registrarFalha).toHaveBeenCalledWith(
      'alerta-1',
      TENTATIVAS_MAXIMAS,
      'Falha inesperada no envio.',
    );
    expect(JSON.stringify(repo.registrarFalha.mock.calls)).not.toContain('segredo');
  });

  it('retoma um alerta que já tinha tentativas, sem passar do limite', async () => {
    const enviar = vi.fn().mockResolvedValue('msg-3');
    const repo = repositorioFalso({
      listarAlertasPendentes: vi.fn().mockResolvedValue([alertaPendente({ tentativas: 2 })]),
    });

    await dispararAlertas(repo, opcoes(provedorFalso(enviar)));

    expect(enviar).toHaveBeenCalledTimes(1);
    expect(repo.registrarEnvio).toHaveBeenCalledWith('alerta-1', 'msg-3', 3);
  });

  it('não envia alerta que já esgotou as tentativas em execução anterior', async () => {
    const enviar = vi.fn();
    const repo = repositorioFalso({
      listarAlertasPendentes: vi
        .fn()
        .mockResolvedValue([alertaPendente({ tentativas: TENTATIVAS_MAXIMAS })]),
    });

    const resumo = await dispararAlertas(repo, opcoes(provedorFalso(enviar)));

    expect(enviar).not.toHaveBeenCalled();
    expect(resumo.falhas).toBe(1);
  });
});
