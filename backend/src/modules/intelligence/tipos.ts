export const CATEGORIAS_AMEACA = [
  'phishing',
  'malware',
  'ransomware',
  'malicious_domain',
  'suspicious_url',
  'digital_fraud',
  'exploited_vulnerability',
] as const;

export type CategoriaAmeaca = (typeof CATEGORIAS_AMEACA)[number];

export const SEVERIDADES = ['baixo', 'moderado', 'alto', 'critico'] as const;

export type Severidade = (typeof SEVERIDADES)[number];

export const TIPOS_INDICADOR = ['domain', 'url', 'ip', 'sha256', 'cve'] as const;

export type TipoIndicador = (typeof TIPOS_INDICADOR)[number];

export interface IndicadorColetado {
  tipo: TipoIndicador;
  valor: string;
}

/** Ameaça já normalizada, pronta para ser gravada. O identificador é único dentro da fonte. */
export interface AmeacaColetada {
  idExterno: string;
  titulo: string;
  descricao: string | null;
  categoria: CategoriaAmeaca;
  severidade: Severidade;
  cveId: string | null;
  urlFonte: string | null;
  publicadoEm: string | null;
  indicadores: IndicadorColetado[];
  /** A própria fonte confirma a ameaça. Só ameaças verificadas geram alerta (ALR-003). */
  verificada?: boolean;
}

export interface ResultadoColeta {
  ameacas: AmeacaColetada[];
  /** Itens do feed que não respeitaram o formato esperado e foram ignorados. */
  descartados: number;
}

export interface AdaptadorFonte {
  coletar(): Promise<ResultadoColeta>;
}

export interface FonteAtiva {
  id: string;
  nome: string;
  tipo: string;
  urlBase: string;
  confiabilidade: number;
}
