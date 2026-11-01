// Espelha as listas do backend (modules/intelligence/tipos.ts). Os rótulos ficam aqui, em português.
export const CATEGORIAS = [
  'phishing',
  'malware',
  'ransomware',
  'malicious_domain',
  'suspicious_url',
  'digital_fraud',
  'exploited_vulnerability',
] as const;

export const SEVERIDADES = ['baixo', 'moderado', 'alto', 'critico'] as const;

export const TIPOS_INDICADOR = ['domain', 'url', 'ip', 'sha256', 'cve'] as const;

export type Categoria = (typeof CATEGORIAS)[number];
export type Severidade = (typeof SEVERIDADES)[number];
export type TipoIndicador = (typeof TIPOS_INDICADOR)[number];

export const ROTULOS_CATEGORIA: Record<Categoria, string> = {
  phishing: 'Phishing',
  malware: 'Malware',
  ransomware: 'Ransomware',
  malicious_domain: 'Domínio malicioso',
  suspicious_url: 'URL suspeita',
  digital_fraud: 'Fraude digital',
  exploited_vulnerability: 'Vulnerabilidade explorada',
};

export const ROTULOS_SEVERIDADE: Record<Severidade, string> = {
  baixo: 'Baixo',
  moderado: 'Moderado',
  alto: 'Alto',
  critico: 'Crítico',
};

export const ROTULOS_ESTADO_VERIFICACAO: Record<string, string> = {
  nao_verificada: 'Não verificada',
  verificada: 'Verificada',
  descartada: 'Descartada',
};

export function formatarData(iso: string | null): string {
  if (!iso) {
    return 'Sem data';
  }
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(iso));
}
