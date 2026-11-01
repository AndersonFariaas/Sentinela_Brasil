import { describe, expect, it } from 'vitest';
import { REGRAS_RISCO } from './regras.js';
import { avaliarEstrutura } from './heuristicas.js';

function idsDisparados(url: string): string[] {
  const parsed = new URL(url);
  return avaliarEstrutura(parsed, parsed.hostname, REGRAS_RISCO).map((evidencia) => evidencia.id);
}

describe('avaliarEstrutura', () => {
  it('não dispara nenhuma regra em um endereço comum com HTTPS', () => {
    expect(idsDisparados('https://www.exemplo.com.br/noticias')).toEqual([]);
  });

  it('marca IP no lugar do nome', () => {
    expect(idsDisparados('https://8.8.8.8/')).toContain('ip_no_host');
  });

  it('marca domínio em punycode', () => {
    expect(idsDisparados('https://xn--pypal-4ve.com/')).toContain('dominio_punycode');
  });

  it('marca conexão sem HTTPS', () => {
    expect(idsDisparados('http://exemplo.com/')).toContain('sem_tls');
  });

  it('marca muitos subdomínios', () => {
    expect(idsDisparados('https://a.b.c.exemplo.com/')).toContain('subdominios_excessivos');
  });

  it('marca palavra de isca no domínio ou no caminho', () => {
    expect(idsDisparados('https://exemplo.com/conta/verificar')).toContain('palavra_isca');
  });

  it('não marca palavra de isca que aparece só dentro de outra palavra', () => {
    expect(idsDisparados('https://exemplo.com/contabilidade')).not.toContain('palavra_isca');
  });

  it('marca extensão de domínio de alto risco', () => {
    expect(idsDisparados('https://exemplo.zip/')).toContain('tld_suspeito');
  });

  it('marca endereço muito longo', () => {
    const longo = `https://exemplo.com/?q=${'x'.repeat(REGRAS_RISCO.estrutura.comprimentoUrlLongo)}`;
    expect(idsDisparados(longo)).toContain('url_longa');
  });

  it('marca muitos hífens no domínio', () => {
    expect(idsDisparados('https://a-b-c-d.exemplo.com/')).toContain('hifens_excessivos');
  });

  it('cada evidência do grupo E carrega o peso configurado', () => {
    const url = new URL('https://8.8.8.8/');
    const [evidencia] = avaliarEstrutura(url, url.hostname, REGRAS_RISCO);

    expect(evidencia).toMatchObject({
      grupo: 'E',
      id: 'ip_no_host',
      peso: REGRAS_RISCO.estrutura.pesos.ip_no_host,
    });
  });
});
