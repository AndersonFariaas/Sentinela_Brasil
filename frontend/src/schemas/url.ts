import { z } from 'zod';

const TAMANHO_MAXIMO_URL = 2048;

/** Aceita só http e https, sem usuário e senha na URL. Mesmas regras que o servidor vai aplicar. */
function ehUrlPublicaValida(valor: string): boolean {
  try {
    const url = new URL(valor);
    const protocoloPermitido = url.protocol === 'http:' || url.protocol === 'https:';
    return protocoloPermitido && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

export const urlSuspeitaSchema = z
  .string()
  .trim()
  .min(1, { error: 'Informe a URL que deseja verificar.' })
  .max(TAMANHO_MAXIMO_URL, { error: 'A URL é longa demais.' })
  .refine(ehUrlPublicaValida, {
    error: 'Informe uma URL completa com http:// ou https://, sem usuário e senha.',
  });
