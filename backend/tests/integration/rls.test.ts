import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { loadEnv, type Env } from '../../src/config/env.js';
import { criarAutenticadorSupabase } from '../../src/integrations/supabase/autenticador.js';
import {
  criarClienteAnonimo,
  criarClienteDoUsuario,
  type ClienteSupabase,
} from '../../src/integrations/supabase/clientes.js';
import type { Database } from '../../src/integrations/supabase/database.types.js';

interface UsuarioDeTeste {
  id: string;
  email: string;
  cliente: ClienteSupabase;
  token: string;
}

const CHAVE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!CHAVE_SERVICE_ROLE) {
  throw new Error(
    'Defina SUPABASE_SERVICE_ROLE_KEY no .env (somente local, nunca no repositório) para rodar os testes de integração.',
  );
}

const env: Env = loadEnv();
const admin = createClient<Database>(env.SUPABASE_URL, CHAVE_SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const usuariosCriados: string[] = [];
const fonteId = randomUUID();
let execucaoId: string;
let usuarioA: UsuarioDeTeste;
let usuarioB: UsuarioDeTeste;
let usuarioAdmin: UsuarioDeTeste;
let scanDeA: string;
let scanDeB: string;

/** Usado só na preparação e na verificação dos testes: falha alto se a operação não deu certo. */
function esperarSucesso<T>(resultado: {
  data: T;
  error: { message: string } | null;
}): NonNullable<T> {
  if (resultado.error || resultado.data === null) {
    throw new Error(`Operação de preparação falhou: ${resultado.error?.message ?? 'sem dados'}`);
  }
  return resultado.data as NonNullable<T>;
}

async function criarUsuario(papel: 'user' | 'admin'): Promise<UsuarioDeTeste> {
  const email = `teste-${randomUUID()}@sentinela.dev`;
  const senha = `${randomUUID()}-Aa1!`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (error) {
    throw new Error(`Falha ao criar usuário de teste: ${error.message}`);
  }
  usuariosCriados.push(data.user.id);

  if (papel === 'admin') {
    esperarSucesso(
      await admin.from('profiles').update({ role: 'admin' }).eq('id', data.user.id).select('id'),
    );
  }

  const sessao = await criarClienteAnonimo(env).auth.signInWithPassword({ email, password: senha });
  const token = sessao.data.session?.access_token;
  if (!token) {
    throw new Error('Falha ao obter sessão do usuário de teste.');
  }

  return {
    id: data.user.id,
    email,
    token,
    cliente: criarClienteDoUsuario(env, token),
  };
}

async function criarScan(userId: string, host: string): Promise<string> {
  const linha = esperarSucesso(
    await admin
      .from('scans')
      .insert({
        user_id: userId,
        url: `https://${host}/`,
        normalized_url: `https://${host}/`,
        host,
        status: 'concluido',
        classification: 'nao_identificado',
        risk_score: 5,
        risk_level: 'baixo',
        algorithm_version: 'teste',
      })
      .select('id')
      .single(),
  );
  return linha.id;
}

beforeAll(async () => {
  usuarioA = await criarUsuario('user');
  usuarioB = await criarUsuario('user');
  usuarioAdmin = await criarUsuario('admin');

  esperarSucesso(
    await admin
      .from('sources')
      .insert({
        id: fonteId,
        name: `DEMO — fonte de teste ${fonteId}`,
        source_type: 'api',
        base_url: 'https://demo.invalid',
        reliability: 3,
      })
      .select('id'),
  );

  const execucao = esperarSucesso(
    await admin
      .from('ingestion_runs')
      .insert({ source_id: fonteId, status: 'ok' })
      .select('id')
      .single(),
  );
  execucaoId = execucao.id;

  scanDeA = await criarScan(usuarioA.id, `a-${fonteId}.invalid`);
  scanDeB = await criarScan(usuarioB.id, `b-${fonteId}.invalid`);
});

afterAll(async () => {
  await admin.from('ingestion_runs').delete().eq('id', execucaoId);
  await admin.from('sources').delete().eq('id', fonteId);
  for (const id of usuariosCriados) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe('RLS: isolamento entre usuários', () => {
  it('anônimo não lê scans', async () => {
    const resultado = await criarClienteAnonimo(env).from('scans').select('id');

    expect(resultado.error).not.toBeNull();
  });

  it('usuário lê só os próprios scans', async () => {
    const resultado = esperarSucesso(await usuarioA.cliente.from('scans').select('id'));

    const ids = resultado.map((linha) => linha.id);
    expect(ids).toContain(scanDeA);
    expect(ids).not.toContain(scanDeB);
  });

  it('usuário não lê profile de outro usuário', async () => {
    const resultado = esperarSucesso(
      await usuarioA.cliente.from('profiles').select('id').eq('id', usuarioB.id),
    );

    expect(resultado).toEqual([]);
  });

  it('usuário não altera o próprio papel (role)', async () => {
    const resultado = await usuarioA.cliente
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', usuarioA.id)
      .select('id');

    expect(resultado.error).not.toBeNull();

    const perfil = esperarSucesso(
      await admin.from('profiles').select('role').eq('id', usuarioA.id).single(),
    );
    expect(perfil.role).toBe('user');
  });

  it('usuário não altera o perfil de outro usuário', async () => {
    const resultado = esperarSucesso(
      await usuarioA.cliente
        .from('profiles')
        .update({ full_name: 'Invasor' })
        .eq('id', usuarioB.id)
        .select('id'),
    );

    expect(resultado).toEqual([]);
  });

  it('usuário não insere scan', async () => {
    const resultado = await usuarioA.cliente.from('scans').insert({
      user_id: usuarioA.id,
      url: 'https://forjado.invalid/',
      normalized_url: 'https://forjado.invalid/',
      host: 'forjado.invalid',
      status: 'concluido',
      classification: 'confirmado',
      risk_score: 100,
      risk_level: 'critico',
      algorithm_version: 'forjado',
    });

    expect(resultado.error).not.toBeNull();
  });

  it('usuário não apaga scan de outro usuário', async () => {
    const resultado = esperarSucesso(
      await usuarioA.cliente.from('scans').delete().eq('id', scanDeB).select('id'),
    );
    expect(resultado).toEqual([]);

    const ainda = esperarSucesso(await admin.from('scans').select('id').eq('id', scanDeB));
    expect(ainda).toHaveLength(1);
  });

  it('usuário não inscreve outro usuário', async () => {
    const resultado = await usuarioA.cliente
      .from('subscriptions')
      .insert({ user_id: usuarioB.id, category: 'phishing' });

    expect(resultado.error).not.toBeNull();
  });

  it('usuário cria inscrição para si mesmo', async () => {
    const criada = await usuarioA.cliente
      .from('subscriptions')
      .insert({ user_id: usuarioA.id, category: 'malware' });

    expect(criada.error).toBeNull();
  });

  it('usuário não cria ameaça', async () => {
    const resultado = await usuarioA.cliente.from('threats').insert({
      dedupe_key: `forjado-${randomUUID()}`,
      title: 'Ameaça forjada',
      category: 'phishing',
      severity: 'critico',
      source_id: fonteId,
    });

    expect(resultado.error).not.toBeNull();
  });

  it('usuário não altera fonte de inteligência', async () => {
    const resultado = esperarSucesso(
      await usuarioA.cliente
        .from('sources')
        .update({ is_active: false })
        .eq('id', fonteId)
        .select('id'),
    );

    expect(resultado).toEqual([]);
  });

  it('usuário não lê ingestion_runs (só administradores)', async () => {
    const resultado = esperarSucesso(await usuarioA.cliente.from('ingestion_runs').select('id'));

    expect(resultado).toEqual([]);
  });

  it('administrador lê scans de todos os usuários', async () => {
    const resultado = esperarSucesso(await usuarioAdmin.cliente.from('scans').select('id'));

    const ids = resultado.map((linha) => linha.id);
    expect(ids).toContain(scanDeA);
    expect(ids).toContain(scanDeB);
  });
});

describe('GET /api/v1/auth/me com Supabase real', () => {
  it('retorna o perfil do usuário com token válido', async () => {
    const app = await buildApp(env, { autenticador: criarAutenticadorSupabase(env) });

    try {
      const resposta = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { authorization: `Bearer ${usuarioA.token}` },
      });

      expect(resposta.statusCode).toBe(200);
      expect(resposta.json()).toMatchObject({
        id: usuarioA.id,
        email: usuarioA.email,
        role: 'user',
      });
    } finally {
      await app.close();
    }
  });

  it('recusa token inválido', async () => {
    const app = await buildApp(env, { autenticador: criarAutenticadorSupabase(env) });

    try {
      const resposta = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { authorization: 'Bearer token.que.nao.existe' },
      });

      expect(resposta.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
});
