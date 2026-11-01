import { describe, expect, it } from 'vitest';
import { urlSuspeitaSchema } from './url';

describe('urlSuspeitaSchema', () => {
  it.each(['https://exemplo.com', 'http://exemplo.com/caminho?x=1'])('aceita %s', (url) => {
    expect(urlSuspeitaSchema.safeParse(url).success).toBe(true);
  });

  it.each([
    ['vazia', ''],
    ['sem protocolo', 'exemplo.com'],
    ['protocolo não permitido', 'ftp://exemplo.com'],
    ['javascript', 'javascript:alert(1)'],
    ['com usuário e senha', 'https://usuario:senha@exemplo.com'],
  ])('recusa URL %s', (_descricao, url) => {
    expect(urlSuspeitaSchema.safeParse(url).success).toBe(false);
  });

  it('recusa URL acima de 2048 caracteres', () => {
    const longa = `https://exemplo.com/${'a'.repeat(2100)}`;
    expect(urlSuspeitaSchema.safeParse(longa).success).toBe(false);
  });
});
