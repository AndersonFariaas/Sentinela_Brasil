import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';
import type { Database } from '../../src/integrations/supabase/database.types.js';
import { criarCancelarInscricaoSupabase } from '../../src/integrations/supabase/cancelamento-supabase.js';
import { criarRepositorioAlertas } from '../../src/integrations/supabase/repositorio-alertas.js';
import type { AlertaPendente } from '../../src/modules/alerts/repositorio.js';

const CHAVE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!CHAVE_SERVICE_ROLE) {
  throw new Error('Defina SUPABASE_SERVICE_ROLE_KEY no .env para rodar os testes de integração.');
}

const env = loadEnv();
const admin = createClient<Database>(env.SUPABASE_URL, CHAVE_SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const repositorio = criarRepositorioAlertas(admin);

const CATEGORIA = 'exploited_vulnerability';
const usuariosCriados: string[] = [];
let ameacaId: string;
let ameacaRegistrada = false;
const emails: Record<string, string> = {};

async function criarUsuario(): Promise<string> {
  const email = `alertas-${randomUUID()}@sentinela.dev`;
  const criacao = await admin.auth.admin.createUser({
    email,
    password: `${randomUUID()}-Aa1!`,
    email_confirm: true,
  });
  if (criacao.error) {
    throw new Error(`Falha ao criar usuário de teste: ${criacao.error.message}`);
  }
  usuariosCriados.push(criacao.data.user.id);
  emails[criacao.data.user.id] = email;
  return criacao.data.user.id;
}

async function idDaFonteKev(): Promise<string> {
  const { data, error } = await admin.from('sources').select('id').eq('name', 'CISA KEV').single();
  if (error) {
    throw new Error(`Fonte de teste não encontrada: ${error.message}`);
  }
  return data.id;
}

function alertasDaAmeaca(pendentes: AlertaPendente[]): AlertaPendente[] {
  return pendentes.filter((alerta) => alerta.ameaca.id === ameacaId);
}

describe('repositório de alertas (Supabase de desenvolvimento)', () => {
  let usuarioA: string;
  let usuarioB: string;

  beforeAll(async () => {
    usuarioA = await criarUsuario();
    usuarioB = await criarUsuario();

    const { error: erroInscricao } = await admin.from('subscriptions').insert([
      { user_id: usuarioA, category: CATEGORIA, enabled: true },
      { user_id: usuarioB, category: CATEGORIA, enabled: true },
    ]);
    if (erroInscricao) {
      throw new Error(`Falha ao criar inscrições: ${erroInscricao.message}`);
    }

    const { data, error } = await admin
      .from('threats')
      .insert({
        dedupe_key: `teste-alerta:${randomUUID()}`,
        title: 'Vulnerabilidade de teste (alertas)',
        description: 'Registro criado pelo teste de integração.',
        category: CATEGORIA,
        severity: 'alto',
        verification_status: 'verificada',
        source_id: await idDaFonteKev(),
        source_url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
        collected_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (error) {
      throw new Error(`Falha ao criar ameaça de teste: ${error.message}`);
    }
    ameacaId = data.id;
    ameacaRegistrada = true;
  });

  afterAll(async () => {
    if (ameacaRegistrada) {
      await admin.from('threats').delete().eq('id', ameacaId);
    }
    for (const usuarioId of usuariosCriados) {
      await admin.auth.admin.deleteUser(usuarioId);
    }
  });

  it('lista os usuários inscritos na categoria', async () => {
    const inscritos = await repositorio.buscarInscritos(CATEGORIA);

    expect(inscritos).toEqual(expect.arrayContaining([usuarioA, usuarioB]));
  });

  it('cria um alerta por usuário e ignora a repetição (idempotência do banco)', async () => {
    const primeira = await repositorio.criarAlertas(ameacaId, [usuarioA, usuarioB]);
    const segunda = await repositorio.criarAlertas(ameacaId, [usuarioA, usuarioB]);

    expect(primeira).toBe(2);
    expect(segunda).toBe(0);
  });

  it('a ameaça verificada aparece na busca da janela', async () => {
    const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const ameacas = await repositorio.buscarAmeacasConfirmadas(desde);

    expect(ameacas.some((ameaca) => ameaca.id === ameacaId)).toBe(true);
  });

  it('entrega os pendentes com e-mail do destinatário e dados da ameaça', async () => {
    const pendentes = alertasDaAmeaca(await repositorio.listarAlertasPendentes(100, 3));

    expect(pendentes.map((alerta) => alerta.destinatario).sort()).toEqual(
      [emails[usuarioA], emails[usuarioB]].sort(),
    );
    for (const alerta of pendentes) {
      expect(alerta.ameaca.titulo).toBe('Vulnerabilidade de teste (alertas)');
      expect(alerta.chaveIdempotencia).toMatch(/^alert:/);
    }
  });

  it('depois de registrar o envio, o alerta sai da fila de pendentes', async () => {
    const [primeiro] = alertasDaAmeaca(await repositorio.listarAlertasPendentes(100, 3));
    if (!primeiro) {
      throw new Error('Nenhum alerta pendente para o teste.');
    }

    await repositorio.registrarEnvio(primeiro.id, 'msg-teste-integracao', 1);

    const restantes = alertasDaAmeaca(await repositorio.listarAlertasPendentes(100, 3));
    expect(restantes.map((alerta) => alerta.id)).not.toContain(primeiro.id);
    expect(restantes).toHaveLength(1);
  });

  it('falha registrada sai da fila e não é reenviada automaticamente', async () => {
    const [restante] = alertasDaAmeaca(await repositorio.listarAlertasPendentes(100, 3));
    if (!restante) {
      throw new Error('Nenhum alerta pendente para o teste.');
    }

    await repositorio.registrarFalha(restante.id, 3, 'Falha de teste.');

    const depois = alertasDaAmeaca(await repositorio.listarAlertasPendentes(100, 3));
    expect(depois).toHaveLength(0);
  });

  it('cancelar_inscricao desativa só a inscrição indicada, pela chave pública', async () => {
    const { data: inscricaoB, error } = await admin
      .from('subscriptions')
      .select('id')
      .eq('user_id', usuarioB)
      .eq('category', CATEGORIA)
      .single();
    if (error) {
      throw new Error(`Inscrição de teste não encontrada: ${error.message}`);
    }

    await criarCancelarInscricaoSupabase(env)(inscricaoB.id);

    const { data: depoisB, error: erroB } = await admin
      .from('subscriptions')
      .select('enabled')
      .eq('id', inscricaoB.id)
      .single();
    const { data: depoisA, error: erroA } = await admin
      .from('subscriptions')
      .select('enabled')
      .eq('user_id', usuarioA)
      .eq('category', CATEGORIA)
      .single();
    if (erroB || erroA) {
      throw new Error('Falha ao reler inscrições após o cancelamento.');
    }

    expect(depoisB.enabled).toBe(false);
    expect(depoisA.enabled).toBe(true);
  });
});
