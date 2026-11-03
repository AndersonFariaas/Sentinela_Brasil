import { z } from 'zod';
import { HOSTS_COLETA_PERMITIDOS } from '../../config/egress.js';
import { ErroColeta } from '../../modules/intelligence/erros.js';
import type {
  AdaptadorFonte,
  AmeacaColetada,
  ResultadoColeta,
} from '../../modules/intelligence/tipos.js';
import { buscarTextoSeguro, type OpcoesBusca } from '../http/cliente-seguro.js';

export const URL_CATALOGO_KEV = 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog';

const TAMANHO_MAXIMO_TITULO = 300;
const TAMANHO_MAXIMO_FEED_BYTES = 10 * 1024 * 1024;

export const OPCOES_CISA_KEV: OpcoesBusca = {
  timeoutMs: 20_000,
  tamanhoMaximoBytes: TAMANHO_MAXIMO_FEED_BYTES,
  hostsPermitidos: HOSTS_COLETA_PERMITIDOS,
};

// Só os campos que o SENTINELA usa. Os demais campos do feed são ignorados.
const itemKevSchema = z.object({
  cveID: z.string().regex(/^CVE-\d{4}-\d{4,}$/),
  vendorProject: z.string(),
  product: z.string(),
  vulnerabilityName: z.string(),
  dateAdded: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shortDescription: z.string(),
  knownRansomwareCampaignUse: z.enum(['Known', 'Unknown']),
});

type ItemKev = z.infer<typeof itemKevSchema>;

const catalogoSchema = z.object({ vulnerabilities: z.array(z.unknown()) });

function truncar(texto: string, limite: number): string {
  return texto.length <= limite ? texto : `${texto.slice(0, limite - 1)}…`;
}

function mapearItem(item: ItemKev): AmeacaColetada {
  return {
    idExterno: item.cveID,
    titulo: truncar(`${item.cveID}: ${item.vulnerabilityName}`, TAMANHO_MAXIMO_TITULO),
    descricao: item.shortDescription,
    categoria: 'exploited_vulnerability',
    // Vulnerabilidade usada em campanhas de ransomware é tratada como crítica.
    severidade: item.knownRansomwareCampaignUse === 'Known' ? 'critico' : 'alto',
    cveId: item.cveID,
    urlFonte: URL_CATALOGO_KEV,
    publicadoEm: `${item.dateAdded}T00:00:00.000Z`,
    indicadores: [{ tipo: 'cve', valor: item.cveID }],
    // A CISA só inclui vulnerabilidades com exploração confirmada.
    verificada: true,
  };
}

/**
 * Lê o catálogo KEV. Um item fora do formato é descartado e contado,
 * sem derrubar a coleta inteira. Um catálogo sem a estrutura básica falha por inteiro.
 */
export function analisarCatalogoKev(texto: string): ResultadoColeta {
  let corpo: unknown;
  try {
    corpo = JSON.parse(texto);
  } catch {
    throw new ErroColeta('O feed do CISA KEV não é um JSON válido.');
  }

  const catalogo = catalogoSchema.safeParse(corpo);
  if (!catalogo.success) {
    throw new ErroColeta('O feed do CISA KEV não tem a estrutura esperada.');
  }

  const ameacas: AmeacaColetada[] = [];
  let descartados = 0;

  for (const bruto of catalogo.data.vulnerabilities) {
    const item = itemKevSchema.safeParse(bruto);
    if (item.success) {
      ameacas.push(mapearItem(item.data));
    } else {
      descartados += 1;
    }
  }

  return { ameacas, descartados };
}

export class AdaptadorCisaKev implements AdaptadorFonte {
  constructor(
    private readonly urlFeed: string,
    private readonly buscar: typeof buscarTextoSeguro = buscarTextoSeguro,
  ) {}

  async coletar(): Promise<ResultadoColeta> {
    const texto = await this.buscar(this.urlFeed, OPCOES_CISA_KEV);
    return analisarCatalogoKev(texto);
  }
}
