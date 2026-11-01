import { isIP } from 'node:net';
import type { TipoIndicador } from './tipos.js';

const TAMANHO_MAXIMO_URL = 2048;
const PADRAO_DOMINIO = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const PADRAO_CVE = /^CVE-\d{4}-\d{4,}$/;
const PADRAO_SHA256 = /^[a-f0-9]{64}$/;
const CARACTERES_PROIBIDOS_EM_DOMINIO = /[/:@?#\s]/;

/** Domínio em minúsculas e em punycode. Recusa caminhos, portas, endereços IP e nomes inválidos. */
export function normalizarDominio(valor: string): string | null {
  const limpo = valor.trim().replace(/\.$/, '');

  if (CARACTERES_PROIBIDOS_EM_DOMINIO.test(limpo)) {
    return null;
  }

  let host: string;
  try {
    host = new URL(`http://${limpo}`).hostname;
  } catch {
    return null;
  }

  if (isIP(host) !== 0) {
    return null;
  }

  return PADRAO_DOMINIO.test(host) ? host : null;
}

/** URL http ou https, sem usuário e senha, sem fragmento, com host normalizado. */
export function normalizarUrl(valor: string): string | null {
  const limpo = valor.trim();

  if (limpo.length === 0 || limpo.length > TAMANHO_MAXIMO_URL) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(limpo);
  } catch {
    return null;
  }

  const protocoloPermitido = url.protocol === 'http:' || url.protocol === 'https:';
  if (!protocoloPermitido || url.username !== '' || url.password !== '') {
    return null;
  }

  url.hash = '';
  return url.toString();
}

export function normalizarIp(valor: string): string | null {
  const limpo = valor.trim();
  return isIP(limpo) !== 0 ? limpo.toLowerCase() : null;
}

export function normalizarCve(valor: string): string | null {
  const maiusculo = valor.trim().toUpperCase();
  return PADRAO_CVE.test(maiusculo) ? maiusculo : null;
}

export function normalizarSha256(valor: string): string | null {
  const minusculo = valor.trim().toLowerCase();
  return PADRAO_SHA256.test(minusculo) ? minusculo : null;
}

/** Ponto de entrada único: aplica a normalização certa para cada tipo de indicador. */
export function normalizarIndicador(tipo: TipoIndicador, valor: string): string | null {
  switch (tipo) {
    case 'domain':
      return normalizarDominio(valor);
    case 'url':
      return normalizarUrl(valor);
    case 'ip':
      return normalizarIp(valor);
    case 'cve':
      return normalizarCve(valor);
    case 'sha256':
      return normalizarSha256(valor);
  }
}
