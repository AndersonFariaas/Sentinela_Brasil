import { describe, expect, it } from 'vitest';
import { ehEnderecoInterno, validarUrlEntrada } from './validacao.js';

describe('validarUrlEntrada', () => {
  it('aceita URL https pública e devolve a forma normalizada', () => {
    const resultado = validarUrlEntrada('  HTTPS://Exemplo.com/login#topo  ');

    expect(resultado).toEqual({
      ok: true,
      normalizada: 'https://exemplo.com/login',
      host: 'exemplo.com',
    });
  });

  it('aceita IP público', () => {
    expect(validarUrlEntrada('http://8.8.8.8/')).toMatchObject({ ok: true, host: '8.8.8.8' });
  });

  it.each([
    ['vazio', '   '],
    ['não é URL', 'isto não é um endereço'],
    ['caractere de controle no meio', 'https://exemplo.com/\u0007caminho'],
    ['acima de 2048 caracteres', `https://exemplo.com/${'a'.repeat(2048)}`],
  ])('rejeita formato inválido: %s', (_, entrada) => {
    expect(validarUrlEntrada(entrada)).toEqual({ ok: false, motivo: 'formato' });
  });

  it.each(['ftp://exemplo.com/arquivo', 'javascript:alert(1)', 'file:///etc/passwd'])(
    'rejeita protocolo que não é http nem https: %s',
    (entrada) => {
      expect(validarUrlEntrada(entrada)).toEqual({ ok: false, motivo: 'protocolo' });
    },
  );

  it('rejeita URL com usuário e senha', () => {
    expect(validarUrlEntrada('https://usuario:senha@exemplo.com/')).toEqual({
      ok: false,
      motivo: 'credenciais',
    });
  });

  it.each([
    ['loopback', 'http://127.0.0.1/admin'],
    ['rede privada 10/8', 'http://10.1.2.3/'],
    ['rede privada 192.168/16', 'http://192.168.0.5/'],
    ['metadados de nuvem', 'http://169.254.169.254/latest/meta-data/'],
    ['IPv6 loopback', 'http://[::1]/'],
    ['IPv4 mapeado em IPv6', 'http://[::ffff:127.0.0.1]/'],
    ['localhost', 'http://localhost:8080/'],
    ['nome sem ponto', 'http://intranet/'],
    ['sufixo .internal', 'http://painel.internal/'],
  ])('rejeita endereço interno: %s', (_, entrada) => {
    expect(validarUrlEntrada(entrada)).toEqual({ ok: false, motivo: 'interno' });
  });
});

describe('ehEnderecoInterno', () => {
  it('não marca IP público como interno', () => {
    expect(ehEnderecoInterno('1.1.1.1')).toBe(false);
    expect(ehEnderecoInterno('example.org')).toBe(false);
  });
});
