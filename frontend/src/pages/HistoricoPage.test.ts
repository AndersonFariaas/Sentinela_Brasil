import type { Session } from '@supabase/supabase-js';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroApi } from '@/services/api';
import { excluirAnalise, listarHistorico, type ResumoAnalise } from '@/services/scans';
import { useSessaoStore } from '@/stores/sessao';
import HistoricoPage from './HistoricoPage.vue';

vi.mock('@/services/scans', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/scans')>();
  return { ...original, listarHistorico: vi.fn(), excluirAnalise: vi.fn() };
});

function resumo(id: string, host: string): ResumoAnalise {
  return {
    id,
    url: `https://${host}/login`,
    host,
    classificacao: 'suspeito',
    pontuacao: 40,
    nivel: 'alto',
    criadaEm: '2026-11-01T12:00:00.000Z',
  };
}

const ID_1 = '11111111-1111-4111-8111-111111111111';
const ID_2 = '22222222-2222-4222-8222-222222222222';

function montar() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const sessao = useSessaoStore();
  sessao.sessao = { access_token: 'token-de-teste' } as Session;

  return mount(HistoricoPage, {
    global: { plugins: [pinia], stubs: { RouterLink: true } },
  });
}

function botaoExcluir(pagina: ReturnType<typeof montar>, host: string) {
  return pagina.find(`[aria-label="Excluir análise de ${host}"]`);
}

describe('HistoricoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mostra as análises da primeira página', async () => {
    vi.mocked(listarHistorico).mockResolvedValue({
      itens: [resumo(ID_1, 'golpe.exemplo.com'), resumo(ID_2, 'outro.exemplo.com')],
      pagina: 1,
      limite: 20,
      temMais: false,
    });

    const pagina = montar();
    await flushPromises();

    expect(listarHistorico).toHaveBeenCalledWith('token-de-teste', 1, 20);
    expect(pagina.text()).toContain('golpe.exemplo.com');
    expect(pagina.text()).toContain('outro.exemplo.com');
  });

  it('mostra estado vazio quando o usuário ainda não fez análises', async () => {
    vi.mocked(listarHistorico).mockResolvedValue({
      itens: [],
      pagina: 1,
      limite: 20,
      temMais: false,
    });

    const pagina = montar();
    await flushPromises();

    expect(pagina.text()).toContain('Nenhuma análise ainda');
  });

  it('exige confirmação antes de excluir e remove a linha depois', async () => {
    vi.mocked(listarHistorico).mockResolvedValue({
      itens: [resumo(ID_1, 'golpe.exemplo.com')],
      pagina: 1,
      limite: 20,
      temMais: false,
    });
    vi.mocked(excluirAnalise).mockResolvedValue(undefined);

    const pagina = montar();
    await flushPromises();

    await botaoExcluir(pagina, 'golpe.exemplo.com').trigger('click');
    expect(excluirAnalise).not.toHaveBeenCalled();
    expect(pagina.text()).toContain('Excluir esta análise?');

    await pagina
      .findAll('button')
      .find((b) => b.text() === 'Sim, excluir')
      ?.trigger('click');
    await flushPromises();

    expect(excluirAnalise).toHaveBeenCalledWith('token-de-teste', ID_1);
    expect(pagina.text()).not.toContain('golpe.exemplo.com');
  });

  it('cancelar a confirmação não chama a API', async () => {
    vi.mocked(listarHistorico).mockResolvedValue({
      itens: [resumo(ID_1, 'golpe.exemplo.com')],
      pagina: 1,
      limite: 20,
      temMais: false,
    });

    const pagina = montar();
    await flushPromises();

    await botaoExcluir(pagina, 'golpe.exemplo.com').trigger('click');
    await pagina
      .findAll('button')
      .find((b) => b.text() === 'Cancelar')
      ?.trigger('click');

    expect(excluirAnalise).not.toHaveBeenCalled();
    expect(pagina.text()).toContain('golpe.exemplo.com');
  });

  it('404 na exclusão tira a linha da lista sem mostrar erro', async () => {
    vi.mocked(listarHistorico).mockResolvedValue({
      itens: [resumo(ID_1, 'golpe.exemplo.com')],
      pagina: 1,
      limite: 20,
      temMais: false,
    });
    vi.mocked(excluirAnalise).mockRejectedValue(new ErroApi(404));

    const pagina = montar();
    await flushPromises();

    await botaoExcluir(pagina, 'golpe.exemplo.com').trigger('click');
    await pagina
      .findAll('button')
      .find((b) => b.text() === 'Sim, excluir')
      ?.trigger('click');
    await flushPromises();

    expect(pagina.text()).not.toContain('golpe.exemplo.com');
    expect(pagina.text()).not.toContain('Não foi possível excluir');
  });

  it('erro de servidor na exclusão mantém a linha e mostra a mensagem', async () => {
    vi.mocked(listarHistorico).mockResolvedValue({
      itens: [resumo(ID_1, 'golpe.exemplo.com')],
      pagina: 1,
      limite: 20,
      temMais: false,
    });
    vi.mocked(excluirAnalise).mockRejectedValue(new ErroApi(500));

    const pagina = montar();
    await flushPromises();

    await botaoExcluir(pagina, 'golpe.exemplo.com').trigger('click');
    await pagina
      .findAll('button')
      .find((b) => b.text() === 'Sim, excluir')
      ?.trigger('click');
    await flushPromises();

    expect(pagina.text()).toContain('golpe.exemplo.com');
    expect(pagina.text()).toContain('Não foi possível excluir esta análise');
  });

  it('"Carregar mais" busca a página seguinte e acrescenta à lista', async () => {
    vi.mocked(listarHistorico)
      .mockResolvedValueOnce({
        itens: [resumo(ID_1, 'primeiro.exemplo.com')],
        pagina: 1,
        limite: 20,
        temMais: true,
      })
      .mockResolvedValueOnce({
        itens: [resumo(ID_2, 'segundo.exemplo.com')],
        pagina: 2,
        limite: 20,
        temMais: false,
      });

    const pagina = montar();
    await flushPromises();

    await pagina
      .findAll('button')
      .find((b) => b.text() === 'Carregar mais')
      ?.trigger('click');
    await flushPromises();

    expect(listarHistorico).toHaveBeenLastCalledWith('token-de-teste', 2, 20);
    expect(pagina.text()).toContain('primeiro.exemplo.com');
    expect(pagina.text()).toContain('segundo.exemplo.com');
  });
});
