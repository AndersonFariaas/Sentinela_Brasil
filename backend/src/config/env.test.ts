import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

const CONFIG_SUPABASE = {
  SUPABASE_URL: 'https://projeto.supabase.co',
  SUPABASE_ANON_KEY: 'chave-publica-de-teste',
};

describe('loadEnv', () => {
  it('aplica valores padrão quando só as variáveis obrigatórias são informadas', () => {
    const env = loadEnv(CONFIG_SUPABASE);

    expect(env).toEqual({
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: 3000,
      LOG_LEVEL: 'info',
      CORS_ORIGIN: ['http://localhost:5173'],
      ...CONFIG_SUPABASE,
    });
  });

  it('converte PORT para número e separa as origens de CORS', () => {
    const env = loadEnv({
      ...CONFIG_SUPABASE,
      PORT: '8080',
      CORS_ORIGIN: 'https://a.example.com, https://b.example.com',
    });

    expect(env.PORT).toBe(8080);
    expect(env.CORS_ORIGIN).toEqual(['https://a.example.com', 'https://b.example.com']);
  });

  it('rejeita PORT fora da faixa e cita só o nome da variável', () => {
    expect(() => loadEnv({ ...CONFIG_SUPABASE, PORT: '70000' })).toThrow(
      'Configuração inválida nas variáveis de ambiente: PORT',
    );
  });

  it('exige a URL do Supabase', () => {
    expect(() => loadEnv({ SUPABASE_ANON_KEY: 'x' })).toThrow('SUPABASE_URL');
  });

  it('exige a chave pública do Supabase', () => {
    expect(() => loadEnv({ SUPABASE_URL: 'https://projeto.supabase.co' })).toThrow(
      'SUPABASE_ANON_KEY',
    );
  });

  it('não expõe o valor informado na mensagem de erro', () => {
    const valorSecreto = 'valor-que-nao-pode-vazar';

    try {
      loadEnv({ ...CONFIG_SUPABASE, LOG_LEVEL: valorSecreto });
      expect.unreachable('loadEnv deveria ter lançado erro');
    } catch (error) {
      expect(String(error)).not.toContain(valorSecreto);
    }
  });
});
