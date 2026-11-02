import { describe, expect, it } from 'vitest';
import { montarEmailAlerta, type AmeacaAlerta } from './template.js';

const AMEACA: AmeacaAlerta = {
  id: '22222222-2222-4222-8222-222222222222',
  titulo: 'CVE-2026-0001: Falha em servidor',
  descricao: 'Vulnerabilidade explorada em campanhas.',
  categoria: 'exploited_vulnerability',
  severidade: 'critico',
  cveId: 'CVE-2026-0001',
  urlFonte: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
};

const CANCELAMENTO =
  'https://api.exemplo.com/api/v1/alertas/cancelar/33333333-3333-4333-8333-333333333333';

describe('montarEmailAlerta', () => {
  it('inclui o link de cancelamento no corpo e no texto', () => {
    const email = montarEmailAlerta(AMEACA, 'pessoa@exemplo.com', CANCELAMENTO);

    expect(email.html).toContain(`href="${CANCELAMENTO}"`);
    expect(email.texto).toContain(`Para cancelar esses alertas: ${CANCELAMENTO}`);
    expect(email.cancelamentoUrl).toBe(CANCELAMENTO);
  });

  it('monta o e-mail com destinatário, assunto, HTML e texto', () => {
    const email = montarEmailAlerta(AMEACA, 'pessoa@exemplo.com', CANCELAMENTO);

    expect(email.para).toBe('pessoa@exemplo.com');
    expect(email.assunto).toBe('Nova ameaça: CVE-2026-0001: Falha em servidor');
    expect(email.html).toContain('<!doctype html>');
    expect(email.texto).toContain('CVE-2026-0001: Falha em servidor');
  });

  it('escapa HTML vindo do feed, para não virar markup no e-mail', () => {
    const ameaca: AmeacaAlerta = {
      ...AMEACA,
      titulo: '<script>alert(1)</script>',
      descricao: '<img src=x onerror="roubar()">',
    };

    const { html } = montarEmailAlerta(ameaca, 'pessoa@exemplo.com', CANCELAMENTO);

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=&quot;roubar()&quot;&gt;');
  });

  it('remove quebras de linha do assunto, para não injetar cabeçalhos', () => {
    const ameaca: AmeacaAlerta = { ...AMEACA, titulo: 'Linha um\r\nBcc: alguem@exemplo.com' };

    const { assunto } = montarEmailAlerta(ameaca, 'pessoa@exemplo.com', CANCELAMENTO);

    expect(assunto).not.toMatch(/[\r\n]/);
  });

  it('limita o tamanho do assunto', () => {
    const ameaca: AmeacaAlerta = { ...AMEACA, titulo: 'x'.repeat(500) };

    const { assunto } = montarEmailAlerta(ameaca, 'pessoa@exemplo.com', CANCELAMENTO);

    expect(assunto.length).toBeLessThanOrEqual(120);
  });

  it('inclui o link da fonte com rel seguro e omite o bloco quando não há URL', () => {
    const comLink = montarEmailAlerta(AMEACA, 'pessoa@exemplo.com', CANCELAMENTO).html;
    const semLink = montarEmailAlerta(
      { ...AMEACA, urlFonte: null },
      'pessoa@exemplo.com',
      CANCELAMENTO,
    ).html;

    expect(comLink).toContain('rel="noopener noreferrer"');
    expect(semLink).not.toContain('Ver fonte oficial');
  });

  it('o texto puro não carrega tags HTML', () => {
    const { texto } = montarEmailAlerta(AMEACA, 'pessoa@exemplo.com', CANCELAMENTO);

    expect(texto).not.toMatch(/<[a-z]/i);
  });
});
