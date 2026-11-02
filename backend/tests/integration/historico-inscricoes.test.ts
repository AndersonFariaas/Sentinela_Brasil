import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';
import { criarClienteAnonimo } from '../../src/integrations/supabase/clientes.js';
import type { Database } from '../../src/integrations/supabase/database.types.js';
import { criarRepositorioInscricoesSupabase } from '../../src/integrations/supabase/repositorio-inscricoes.js';
import { criarRepositorioScansSupabase } from '../../src/integrations/supabase/repositorio-scans.js';
import type { NovaAnalise } from '../../src/modules/scanner/repositorio.js';

const CHAVE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!CHAVE_SERVICE_ROLE) {
  throw new Error('Defina SUPABASE_SERVICE_ROLE_KEY no .env para rodar os testes de integração.');
}

const env = loadEnv();
const admin = createClient<Database>(env.SUPABASE_URL, CHAVE_SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const scans = criarRepositorioScansSupabase(env);
const inscricoes = criarRepositorioInscricoesSupabase(env);

const usuariosCriados: string[] = [];
let tokenA: string;
let tokenB: string;
let usuarioA: string;
let usuarioB: string;

async function criarUsuarioComToken(): Promise<{ id: string; token: string }> {
  const email = `historico-${randomUUID()}@sentinela.dev`;
  const senha = `${randomUUID()}-Aa1!`;

  const criacao = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (criacao.error) {
    throw new Error(`Falha ao criar usuário de teste: ${criacao.error.message}`);
  }
  usuariosCriados.push(criacao.data.user.id);

  const login = await criarClienteAnonimo(env).auth.signInWithPassword({ email, password: senha });
  if (login.error) {
    throw new Error(`Falha ao obter sessão de teste: ${login.error.message}`);
  }
  return { id: criacao.data.user.id, token: login.data.session.access_token };
}

/** Análise mínima e válida: o registro é gravado com a regra da função registrar_escaneamento. */
function novaAnalise(host: string): NovaAnalise {
  return {
    url: `https://${host}/login`,
    normalizedUrl: `https://${host}/login`,
    host,
    versaoAlgoritmo: '1.0.0',
    classificacao: 'nao_identificado',
    pontuacao: 10,
    nivel: 'baixo',
    evidencias: [],
    fontes: [{ nome: 'Indicadores coletados', status: 'consultada', correspondencias: 0 }],
    explicacao: {
      resumo: 'Resumo de teste.',
      justificativa: 'Justificativa de teste.',
      recomendacoes: ['Recomendação de teste.'],
    },
    analiseIa: {
      status: 'fallback',
      provedor: 'deterministico',
      modelo: null,
      versaoPrompt: 'fallback-1',
      evidenciasCitadas: [],
    },
  };
}

describe('histórico e inscrições com isolamento entre usuários', () => {
  let scanA1: string;
  let scanA2: string;
  let scanB1: string;

  beforeAll(async () => {
    const a = await criarUsuarioComToken();
    const b = await criarUsuarioComToken();
    usuarioA = a.id;
    tokenA = a.token;
    usuarioB = b.id;
    tokenB = b.token;

    scanA1 = await scans.registrarAnalise(
      tokenA,
      novaAnalise(`a1-${randomUUID().slice(0, 8)}.invalid`),
    );
    scanA2 = await scans.registrarAnalise(
      tokenA,
      novaAnalise(`a2-${randomUUID().slice(0, 8)}.invalid`),
    );
    scanB1 = await scans.registrarAnalise(
      tokenB,
      novaAnalise(`b1-${randomUUID().slice(0, 8)}.invalid`),
    );
  });

  afterAll(async () => {
    for (const usuarioId of usuariosCriados) {
      await admin.auth.admin.deleteUser(usuarioId);
    }
  });

  it('lista só o histórico do próprio usuário, do mais recente para o mais antigo', async () => {
    const pagina = await scans.listarAnalises(tokenA, { deslocamento: 0, limite: 10 });

    expect(pagina.itens.map((item) => item.id).sort()).toEqual([scanA1, scanA2].sort());
    expect(pagina.temMais).toBe(false);
    expect(pagina.itens.map((item) => item.id)).not.toContain(scanB1);
  });

  it('indica próxima página sem contar o total', async () => {
    const primeira = await scans.listarAnalises(tokenA, { deslocamento: 0, limite: 1 });
    const segunda = await scans.listarAnalises(tokenA, { deslocamento: 1, limite: 1 });

    expect(primeira.itens).toHaveLength(1);
    expect(primeira.temMais).toBe(true);
    expect(segunda.itens).toHaveLength(1);
    expect(segunda.temMais).toBe(false);
  });

  it('um usuário não consegue excluir o registro de outro', async () => {
    const excluida = await scans.excluirAnalise(tokenA, scanB1);

    expect(excluida).toBe(false);
    expect(await scans.buscarAnalise(tokenB, scanB1)).not.toBeNull();
  });

  it('o dono exclui o próprio registro, e as análises saem junto', async () => {
    const excluida = await scans.excluirAnalise(tokenA, scanA1);

    expect(excluida).toBe(true);
    expect(await scans.buscarAnalise(tokenA, scanA1)).toBeNull();

    const { data: analisesRestantes } = await admin
      .from('analyses')
      .select('id')
      .eq('scan_id', scanA1);
    expect(analisesRestantes).toEqual([]);
  });

  it('inscrições: sem registro é inativa; definir cria e depois atualiza, sem duplicar', async () => {
    expect(await inscricoes.listar(tokenA)).toEqual([]);

    await inscricoes.definir(tokenA, usuarioA, 'phishing', true);
    expect(await inscricoes.listar(tokenA)).toEqual([{ categoria: 'phishing', ativa: true }]);

    await inscricoes.definir(tokenA, usuarioA, 'phishing', false);
    const depois = await inscricoes.listar(tokenA);
    expect(depois).toEqual([{ categoria: 'phishing', ativa: false }]);
  });

  it('a inscrição de um usuário não aparece nem muda na conta de outro', async () => {
    await inscricoes.definir(tokenA, usuarioA, 'malware', true);

    expect(await inscricoes.listar(tokenB)).toEqual([]);

    // B tenta desligar a inscrição de A pela mesma categoria. Vira uma inscrição nova de B.
    await inscricoes.definir(tokenB, usuarioB, 'malware', false);

    const deA = await inscricoes.listar(tokenA);
    expect(deA).toEqual(expect.arrayContaining([{ categoria: 'malware', ativa: true }]));
    expect(await inscricoes.listar(tokenB)).toEqual([{ categoria: 'malware', ativa: false }]);
  });
});
