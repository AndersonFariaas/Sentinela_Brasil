/**
 * Hosts que o servidor pode consultar para coletar dados (security.md §3).
 * Qualquer outro host é recusado pelo cliente HTTP seguro, antes de a conexão sair.
 *
 * Os SDKs de Anthropic e Resend têm seus próprios endereços fixos, e a lista de saída do
 * firewall da hospedagem cobre esses destinos. Eles não passam por esta lista no código.
 */
export const HOSTS_COLETA_PERMITIDOS: readonly string[] = ['www.cisa.gov'];
