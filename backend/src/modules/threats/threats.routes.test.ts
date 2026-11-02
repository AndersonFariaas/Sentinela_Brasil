import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import type { Env } from '../../config/env.js';
import { TOKEN_VALIDO, criarAutenticadorFalso } from '../../../tests/helpers/autenticador-falso.js';
import type { AmeacaDetalhe, AmeacaResumo, IndicadorResumo, LeitorAmeacas } from './leitor.js';

const ENV_TESTE: Env = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: 3000,
  LOG_LEVEL: 'silent',
  CORS_ORIGIN: ['http://localhost:5173'],
  SUPABASE_URL: 'https://projeto.supabase.co',
  SUPABASE_ANON_KEY: 'chave-publica-de-teste',
};

const AMEACA: AmeacaResumo = {
  id: '44444444-4444-4444-8444-444444444444',
  titulo: 'CVE-2025-0001: Execução remota',
  descricao: 'Descrição de teste.',
  categoria: 'exploited_vulnerability',
  severidade: 'alto',
  estadoVerificacao: 'nao_verificada',
  cveId: 'CVE-2025-0001',
  urlFonte: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
  fonte: { nome: 'CISA KEV' },
  publicadoEm: '2025-03-10T00:00:00.000Z',
  coletadoEm: '2026-11-01T03:00:00.000Z',
  ultimaVerificacao: '2026-11-01T03:00:00.000Z',
};

const INDICADOR: IndicadorResumo = {
  id: '55555555-5555-4555-8555-555555555555',
  tipo: 'cve',
  valor: 'CVE-2025-0001',
  confianca: 50,
  primeiraVez: '2026-11-01T03:00:00.000Z',
  ultimaVez: '2026-11-01T03:00:00.000Z',
};

function leitorFalso(sobrescrever: Partial<LeitorAmeacas> = {}): LeitorAmeacas {
  return {
    listarAmeacas: vi.fn().mockResolvedValue([]),
    buscarAmeaca: vi.fn().mockResolvedValue(null),
    listarIndicadores: vi.fn().mockResolvedValue([]),
    buscarIndicador: vi.fn().mockResolvedValue(null),
    ...sobrescrever,
  };
}

const AUTENTICADO = { authorization: `Bearer ${TOKEN_VALIDO}` };

describe('rotas do Threat Feed', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function iniciar(leitor: LeitorAmeacas): Promise<FastifyInstance> {
    app = await buildApp(ENV_TESTE, { autenticador: criarAutenticadorFalso(), leitor });
    return app;
  }

  it('exige login para listar ameaças', async () => {
    const servidor = await iniciar(leitorFalso());

    const resposta = await servidor.inject({ method: 'GET', url: '/api/v1/threats' });

    expect(resposta.statusCode).toBe(401);
  });

  it('lista ameaças com o token do usuário e informa se há próxima página', async () => {
    const listarAmeacas = vi.fn().mockResolvedValue([AMEACA, { ...AMEACA, id: 'outra' }]);
    const servidor = await iniciar(leitorFalso({ listarAmeacas }));

    const resposta = await servidor.inject({
      method: 'GET',
      url: '/api/v1/threats?limite=1',
      headers: AUTENTICADO,
    });

    expect(resposta.statusCode).toBe(200);
    expect(listarAmeacas).toHaveBeenCalledWith(
      TOKEN_VALIDO,
      expect.objectContaining({ limite: 2, pagina: 1 }),
    );
    expect(resposta.json()).toMatchObject({ limite: 1, pagina: 1, temMais: true });
    expect(resposta.json<{ itens: unknown[] }>().itens).toHaveLength(1);
  });

  it('recusa a página 0, já que a paginação começa em 1', async () => {
    const listarAmeacas = vi.fn();
    const servidor = await iniciar(leitorFalso({ listarAmeacas }));

    const resposta = await servidor.inject({
      method: 'GET',
      url: '/api/v1/threats?pagina=0',
      headers: AUTENTICADO,
    });

    expect(resposta.statusCode).toBe(400);
    expect(listarAmeacas).not.toHaveBeenCalled();
  });

  it('repassa os filtros de categoria e severidade', async () => {
    const listarAmeacas = vi.fn().mockResolvedValue([]);
    const servidor = await iniciar(leitorFalso({ listarAmeacas }));

    await servidor.inject({
      method: 'GET',
      url: '/api/v1/threats?categoria=malware&severidade=critico',
      headers: AUTENTICADO,
    });

    expect(listarAmeacas).toHaveBeenCalledWith(
      TOKEN_VALIDO,
      expect.objectContaining({ categoria: 'malware', severidade: 'critico' }),
    );
  });

  it('recusa categoria desconhecida com erro de validação', async () => {
    const servidor = await iniciar(leitorFalso());

    const resposta = await servidor.inject({
      method: 'GET',
      url: '/api/v1/threats?categoria=inventada',
      headers: AUTENTICADO,
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json()).toEqual({
      error: { code: 'DADOS_INVALIDOS', message: 'Parâmetros inválidos: categoria.' },
    });
  });

  it('recusa limite acima do máximo', async () => {
    const servidor = await iniciar(leitorFalso());

    const resposta = await servidor.inject({
      method: 'GET',
      url: '/api/v1/threats?limite=500',
      headers: AUTENTICADO,
    });

    expect(resposta.statusCode).toBe(400);
  });

  it('devolve o detalhe da ameaça com os indicadores', async () => {
    const detalhe: AmeacaDetalhe = { ...AMEACA, indicadores: [INDICADOR] };
    const servidor = await iniciar(
      leitorFalso({ buscarAmeaca: vi.fn().mockResolvedValue(detalhe) }),
    );

    const resposta = await servidor.inject({
      method: 'GET',
      url: `/api/v1/threats/${AMEACA.id}`,
      headers: AUTENTICADO,
    });

    expect(resposta.statusCode).toBe(200);
    expect(resposta.json()).toMatchObject({
      id: AMEACA.id,
      fonte: { nome: 'CISA KEV' },
      indicadores: [{ tipo: 'cve', valor: 'CVE-2025-0001' }],
    });
  });

  it('responde 404 quando a ameaça não existe ou não é visível ao usuário', async () => {
    const servidor = await iniciar(leitorFalso());

    const resposta = await servidor.inject({
      method: 'GET',
      url: `/api/v1/threats/${AMEACA.id}`,
      headers: AUTENTICADO,
    });

    expect(resposta.statusCode).toBe(404);
    expect(resposta.json<{ error: { code: string } }>().error.code).toBe('NAO_ENCONTRADO');
  });

  it('recusa id que não é UUID', async () => {
    const servidor = await iniciar(leitorFalso());

    const resposta = await servidor.inject({
      method: 'GET',
      url: '/api/v1/threats/nao-e-uuid',
      headers: AUTENTICADO,
    });

    expect(resposta.statusCode).toBe(400);
  });

  it('lista indicadores com filtro de tipo', async () => {
    const listarIndicadores = vi.fn().mockResolvedValue([INDICADOR]);
    const servidor = await iniciar(leitorFalso({ listarIndicadores }));

    const resposta = await servidor.inject({
      method: 'GET',
      url: '/api/v1/indicators?tipo=cve',
      headers: AUTENTICADO,
    });

    expect(resposta.statusCode).toBe(200);
    expect(listarIndicadores).toHaveBeenCalledWith(
      TOKEN_VALIDO,
      expect.objectContaining({ tipo: 'cve' }),
    );
    expect(resposta.json<{ itens: unknown[] }>().itens).toHaveLength(1);
  });
});
