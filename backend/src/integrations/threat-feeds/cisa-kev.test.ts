import { describe, expect, it, vi } from 'vitest';
import { ErroColeta } from '../../modules/intelligence/erros.js';
import { AdaptadorCisaKev, URL_CATALOGO_KEV, analisarCatalogoKev } from './cisa-kev.js';

const ITEM_VALIDO = {
  cveID: 'CVE-2025-0001',
  vendorProject: 'Acme',
  product: 'Gateway',
  vulnerabilityName: 'Execução remota de código',
  dateAdded: '2025-03-10',
  shortDescription: 'Permite execução remota.',
  requiredAction: 'Aplicar a correção.',
  knownRansomwareCampaignUse: 'Unknown',
};

function catalogo(itens: unknown[]): string {
  return JSON.stringify({ title: 'KEV', catalogVersion: '1', vulnerabilities: itens });
}

describe('analisarCatalogoKev', () => {
  it('mapeia um item válido para uma ameaça de vulnerabilidade explorada', () => {
    const { ameacas, descartados } = analisarCatalogoKev(catalogo([ITEM_VALIDO]));

    expect(descartados).toBe(0);
    expect(ameacas).toEqual([
      {
        idExterno: 'CVE-2025-0001',
        titulo: 'CVE-2025-0001: Execução remota de código',
        descricao: 'Permite execução remota.',
        categoria: 'exploited_vulnerability',
        severidade: 'alto',
        cveId: 'CVE-2025-0001',
        urlFonte: URL_CATALOGO_KEV,
        publicadoEm: '2025-03-10T00:00:00.000Z',
        indicadores: [{ tipo: 'cve', valor: 'CVE-2025-0001' }],
        verificada: true,
      },
    ]);
  });

  it('marca como crítico quando o item é usado em campanha de ransomware', () => {
    const { ameacas } = analisarCatalogoKev(
      catalogo([{ ...ITEM_VALIDO, knownRansomwareCampaignUse: 'Known' }]),
    );

    expect(ameacas[0]?.severidade).toBe('critico');
  });

  it('descarta item fora do formato sem derrubar os demais', () => {
    const { ameacas, descartados } = analisarCatalogoKev(
      catalogo([ITEM_VALIDO, { ...ITEM_VALIDO, cveID: 'NAO-E-CVE' }, { sem: 'campos' }]),
    );

    expect(ameacas).toHaveLength(1);
    expect(descartados).toBe(2);
  });

  it('recusa conteúdo que não é JSON', () => {
    expect(() => analisarCatalogoKev('<html>página de erro</html>')).toThrow(ErroColeta);
  });

  it('recusa catálogo sem a lista de vulnerabilidades', () => {
    expect(() => analisarCatalogoKev(JSON.stringify({ title: 'sem lista' }))).toThrow(
      'não tem a estrutura esperada',
    );
  });

  it('trunca títulos acima de 300 caracteres', () => {
    const longo = 'x'.repeat(400);
    const { ameacas } = analisarCatalogoKev(
      catalogo([{ ...ITEM_VALIDO, vulnerabilityName: longo }]),
    );

    expect(ameacas[0]?.titulo.length).toBe(300);
  });
});

describe('AdaptadorCisaKev', () => {
  it('usa o buscador seguro e analisa o texto recebido', async () => {
    const buscar = vi.fn().mockResolvedValue(catalogo([ITEM_VALIDO]));
    const adaptador = new AdaptadorCisaKev('https://www.cisa.gov/feed.json', buscar);

    const resultado = await adaptador.coletar();

    expect(buscar).toHaveBeenCalledWith(
      'https://www.cisa.gov/feed.json',
      expect.objectContaining({ hostsPermitidos: ['www.cisa.gov'] }),
    );
    expect(resultado.ameacas).toHaveLength(1);
  });
});
