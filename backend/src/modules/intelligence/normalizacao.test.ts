import { describe, expect, it } from 'vitest';
import {
  normalizarCve,
  normalizarDominio,
  normalizarIndicador,
  normalizarIp,
  normalizarSha256,
  normalizarUrl,
} from './normalizacao.js';

describe('normalizarDominio', () => {
  it('põe em minúsculas e remove ponto final', () => {
    expect(normalizarDominio('Exemplo.COM.')).toBe('exemplo.com');
  });

  it('converte nome internacionalizado para punycode', () => {
    expect(normalizarDominio('bücher.de')).toBe('xn--bcher-kva.de');
  });

  it.each([
    ['caminho', 'exemplo.com/login'],
    ['porta', 'exemplo.com:8080'],
    ['arroba', 'usuario@exemplo.com'],
    ['endereço IP', '192.168.0.1'],
    ['sem domínio de topo', 'localhost'],
    ['espaço', 'exemplo .com'],
  ])('recusa %s', (_descricao, valor) => {
    expect(normalizarDominio(valor)).toBeNull();
  });
});

describe('normalizarUrl', () => {
  it('mantém http e https e remove fragmento', () => {
    expect(normalizarUrl('https://Exemplo.com/caminho#secao')).toBe('https://exemplo.com/caminho');
  });

  it.each([
    ['protocolo ftp', 'ftp://exemplo.com/arquivo'],
    ['javascript', 'javascript:alert(1)'],
    ['usuário e senha', 'https://usuario:senha@exemplo.com/'],
    ['texto que não é URL', 'isto não é uma url'],
  ])('recusa %s', (_descricao, valor) => {
    expect(normalizarUrl(valor)).toBeNull();
  });

  it('recusa URL acima de 2048 caracteres', () => {
    expect(normalizarUrl(`https://exemplo.com/${'a'.repeat(2100)}`)).toBeNull();
  });
});

describe('normalizarIp', () => {
  it('aceita IPv4 e IPv6 válidos', () => {
    expect(normalizarIp('203.0.113.7')).toBe('203.0.113.7');
    expect(normalizarIp('2001:DB8::1')).toBe('2001:db8::1');
  });

  it('recusa texto que não é IP', () => {
    expect(normalizarIp('999.1.1.1')).toBeNull();
  });
});

describe('normalizarCve', () => {
  it('põe o identificador em maiúsculas', () => {
    expect(normalizarCve('cve-2024-12345')).toBe('CVE-2024-12345');
  });

  it('recusa formato sem ano ou sem número', () => {
    expect(normalizarCve('CVE-24-1')).toBeNull();
    expect(normalizarCve('CVE-2024-')).toBeNull();
  });
});

describe('normalizarSha256', () => {
  it('aceita só 64 caracteres hexadecimais', () => {
    const hash = 'A'.repeat(64);
    expect(normalizarSha256(hash)).toBe('a'.repeat(64));
    expect(normalizarSha256('a'.repeat(63))).toBeNull();
  });
});

describe('normalizarIndicador', () => {
  it('despacha para a regra do tipo informado', () => {
    expect(normalizarIndicador('domain', 'Exemplo.com')).toBe('exemplo.com');
    expect(normalizarIndicador('cve', 'cve-2025-0001')).toBe('CVE-2025-0001');
  });
});
