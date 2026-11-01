import { describe, expect, it } from 'vitest';
import { cadastroSchema, entrarSchema } from './autenticacao';

describe('entrarSchema', () => {
  it('aceita e-mail válido com senha preenchida', () => {
    const resultado = entrarSchema.safeParse({ email: 'ana@exemplo.com', senha: 'qualquer' });
    expect(resultado.success).toBe(true);
  });

  it('recusa e-mail sem formato válido', () => {
    const resultado = entrarSchema.safeParse({ email: 'nao-e-email', senha: 'x' });
    expect(resultado.success).toBe(false);
  });

  it('recusa senha vazia', () => {
    const resultado = entrarSchema.safeParse({ email: 'ana@exemplo.com', senha: '' });
    expect(resultado.success).toBe(false);
  });
});

describe('cadastroSchema', () => {
  const base = {
    email: 'ana@exemplo.com',
    senha: 'senha-forte-1',
    confirmarSenha: 'senha-forte-1',
  };

  it('aceita dados válidos com senhas iguais', () => {
    expect(cadastroSchema.safeParse(base).success).toBe(true);
  });

  it('recusa senha com menos de 8 caracteres', () => {
    const resultado = cadastroSchema.safeParse({
      ...base,
      senha: 'curta',
      confirmarSenha: 'curta',
    });
    expect(resultado.success).toBe(false);
  });

  it('recusa senhas diferentes e aponta o campo de confirmação', () => {
    const resultado = cadastroSchema.safeParse({ ...base, confirmarSenha: 'outra-senha-2' });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.issues[0]?.path).toEqual(['confirmarSenha']);
    }
  });
});
