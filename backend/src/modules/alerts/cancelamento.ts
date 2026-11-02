/** Link de cancelamento. O id da inscrição é o único segredo: é aleatório e só o destinatário o recebe. */
export function montarUrlCancelamento(urlPublicaApi: string, inscricaoId: string): string {
  const base = urlPublicaApi.replace(/\/+$/, '');
  return `${base}/api/v1/alertas/cancelar/${inscricaoId}`;
}
