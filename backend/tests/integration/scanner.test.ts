import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { loadEnv } from '../../src/config/env.js';
import { criarAutenticadorSupabase } from '../../src/integrations/supabase/autenticador.js';
import { criarClienteAnonimo } from '../../src/integrations/supabase/clientes.js';
import type { Database } from '../../src/integrations/supabase/database.types.js';
import { criarRepositorioScansSupabase } from '../../src/integrations/supabase/repositorio-scans.js';

const CHAVE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!CHAVE_SERVICE_ROLE) {
  throw new Error('Defina SUPABASE_SERVICE_ROLE_KEY no .env para rodar os testes de integração.');
}

const env = loadEnv();
const admin = createClient<Database>(env.SUPABASE_URL, CHAVE_SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

// Domínio de teste sob .invalid: nunca resolve e não colide com dados reais.
const DOMINIO_MALICIOSO = `golpe-${randomUUID().slice(0, 8)}.invalid`;

const usuariosCriados: string[] = [];
let indicadorCriado: string | null = null;
// Opcional: se a preparação falhar, a limpeza dos usuários ainda precisa rodar.
let servidor: FastifyInstance | undefined;
let tokenA: string;
let tokenB: string;

function instancia(): FastifyInstance {
  if (!servidor) {
    throw new Error('Servidor de teste não foi iniciado na preparação.');
  }
  return servidor;
}

async function criarUsuarioComToken(): Promise<string> {
  const email = `scanner-${randomUUID()}@sentinela.dev`;
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

  const cliente = criarClienteAnonimo(env);
  const login = await cliente.auth.signInWithPassword({ email, password: senha });
  if (login.error) {
    throw new Error(`Falha ao obter sessão do usuário de teste: ${login.error.message}`);
  }
  return login.data.session.access_token;
}

async function criarIndicadorDeReputacao(): Promise<void> {
  const { data: fonte, error: erroFonte } = await admin
    .from('sources')
    .select('id')
    .eq('name', 'CISA KEV')
    .single();
  if (erroFonte) {
    throw new Error(`Fonte de teste não encontrada: ${erroFonte.message}`);
  }

  const { data, error } = await admin
    .from('indicators')
    .insert({ indicator_type: 'domain', indicator_value: DOMINIO_MALICIOSO, source_id: fonte.id })
    .select('id')
    .single();
  if (error) {
    throw new Error(`Falha ao criar indicador de teste: ${error.message}`);
  }
  indicadorCriado = data.id;
}

beforeAll(async () => {
  tokenA = await criarUsuarioComToken();
  tokenB = await criarUsuarioComToken();
  await criarIndicadorDeReputacao();

  servidor = await buildApp(env, {
    autenticador: criarAutenticadorSupabase(env),
    repositorioScans: criarRepositorioScansSupabase(env),
  });
});

afterAll(async () => {
  await servidor?.close();

  // Os escaneamentos saem junto com o usuário (on delete cascade).
  if (indicadorCriado) {
    await admin.from('indicators').delete().eq('id', indicadorCriado);
  }
  for (const id of usuariosCriados) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe('scanner com o Supabase real', () => {
  it('analisa uma URL sem reputação conhecida e grava o resultado para o dono', async () => {
    const resposta = await instancia().inject({
      method: 'POST',
      url: '/api/v1/scans',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { url: 'https://www.exemplo-sem-registro.com.br/pagina' },
    });

    expect(resposta.statusCode).toBe(201);
    const corpo = resposta.json<{ id: string; classificacao: string; pontuacao: number }>();
    expect(corpo.classificacao).toBe('nao_identificado');
    expect(corpo.pontuacao).toBeLessThanOrEqual(39);

    const leitura = await instancia().inject({
      method: 'GET',
      url: `/api/v1/scans/${corpo.id}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(leitura.statusCode).toBe(200);
  });

  it('confirma URL cujo domínio está em indicador de fonte ativa', async () => {
    const resposta = await instancia().inject({
      method: 'POST',
      url: '/api/v1/scans',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { url: `https://pagina.${DOMINIO_MALICIOSO}/entrar` },
    });

    expect(resposta.statusCode).toBe(201);
    const corpo = resposta.json<{
      classificacao: string;
      fontes: { nome: string; correspondencias: number }[];
    }>();
    expect(corpo.classificacao).toBe('confirmado');
    expect(corpo.fontes).toContainEqual(
      expect.objectContaining({ nome: 'CISA KEV', correspondencias: 1 }),
    );
  });

  it('não deixa outro usuário ler o escaneamento (RLS)', async () => {
    const criacao = await instancia().inject({
      method: 'POST',
      url: '/api/v1/scans',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { url: 'https://privado.exemplo-sem-registro.com.br/' },
    });
    const { id } = criacao.json<{ id: string }>();

    const resposta = await instancia().inject({
      method: 'GET',
      url: `/api/v1/scans/${id}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });

    expect(resposta.statusCode).toBe(404);
  });

  it('recusa endereço interno antes de qualquer consulta ao banco', async () => {
    const resposta = await instancia().inject({
      method: 'POST',
      url: '/api/v1/scans',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { url: 'http://169.254.169.254/latest/meta-data/' },
    });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json<{ error: { code: string } }>().error.code).toBe('URL_INVALIDA');
  });
});
