import { BlockList, isIP } from 'node:net';
import { normalizarUrl } from '../intelligence/normalizacao.js';

export const TAMANHO_MAXIMO_URL = 2048;

const PROTOCOLOS_PERMITIDOS = new Set(['http:', 'https:']);
const SUFIXOS_INTERNOS = ['.localhost', '.local', '.internal', '.localdomain'];

// Faixas que nunca são públicas. Bloqueadas antes de qualquer análise, para que
// o scanner não seja usado para mapear a rede interna do servidor ou do usuário.
// Uma lista por família: uma regra IPv6 (como ::ffff:0:0/96) casa com IPv4 se misturada.
const FAIXAS_IPV4 = new BlockList();
FAIXAS_IPV4.addSubnet('0.0.0.0', 8, 'ipv4');
FAIXAS_IPV4.addSubnet('10.0.0.0', 8, 'ipv4');
FAIXAS_IPV4.addSubnet('100.64.0.0', 10, 'ipv4');
FAIXAS_IPV4.addSubnet('127.0.0.0', 8, 'ipv4');
FAIXAS_IPV4.addSubnet('169.254.0.0', 16, 'ipv4');
FAIXAS_IPV4.addSubnet('172.16.0.0', 12, 'ipv4');
FAIXAS_IPV4.addSubnet('192.168.0.0', 16, 'ipv4');
FAIXAS_IPV4.addSubnet('224.0.0.0', 3, 'ipv4');

const FAIXAS_IPV6 = new BlockList();
FAIXAS_IPV6.addSubnet('::', 128, 'ipv6');
FAIXAS_IPV6.addSubnet('::1', 128, 'ipv6');
FAIXAS_IPV6.addSubnet('fc00::', 7, 'ipv6');
FAIXAS_IPV6.addSubnet('fe80::', 10, 'ipv6');
FAIXAS_IPV6.addSubnet('ff00::', 8, 'ipv6');
// Endereços IPv4 escritos em formato IPv6 (::ffff:a.b.c.d) são tratados como internos.
FAIXAS_IPV6.addSubnet('::ffff:0:0', 96, 'ipv6');

export type MotivoRejeicao = 'formato' | 'protocolo' | 'credenciais' | 'interno';

export type ResultadoValidacao =
  { ok: true; normalizada: string; host: string } | { ok: false; motivo: MotivoRejeicao };

// Caracteres de controle (ASCII 0–31 e 127) não existem em URLs válidas.
function possuiControle(texto: string): boolean {
  for (let posicao = 0; posicao < texto.length; posicao += 1) {
    const codigo = texto.charCodeAt(posicao);
    if (codigo < 32 || codigo === 127) {
      return true;
    }
  }
  return false;
}

/** Remove os colchetes que o WHATWG URL mantém em endereços IPv6. */
function semColchetes(host: string): string {
  return host.replace(/^\[(.*)\]$/, '$1');
}

export function ehEnderecoInterno(host: string): boolean {
  const familia = isIP(host);
  if (familia === 4) {
    return FAIXAS_IPV4.check(host, 'ipv4');
  }
  if (familia === 6) {
    return FAIXAS_IPV6.check(host, 'ipv6');
  }

  // "localhost." e "localhost" são o mesmo nome. Sem tirar o ponto final, o sufixo não casa.
  const nome = host.replace(/\.+$/, '');
  // Nome sem ponto (ex.: "intranet") só resolve dentro de uma rede local.
  const semPonto = !nome.includes('.');
  const sufixoInterno = SUFIXOS_INTERNOS.some((sufixo) => nome.endsWith(sufixo));
  return semPonto || sufixoInterno;
}

/**
 * Valida a URL enviada pelo usuário sem acessá-la. Só a string é analisada,
 * então nenhuma conexão de rede é feita com o endereço informado.
 */
export function validarUrlEntrada(entrada: string): ResultadoValidacao {
  const texto = entrada.trim();
  if (texto.length === 0 || texto.length > TAMANHO_MAXIMO_URL || possuiControle(texto)) {
    return { ok: false, motivo: 'formato' };
  }

  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    return { ok: false, motivo: 'formato' };
  }

  if (!PROTOCOLOS_PERMITIDOS.has(url.protocol)) {
    return { ok: false, motivo: 'protocolo' };
  }

  if (url.username !== '' || url.password !== '') {
    return { ok: false, motivo: 'credenciais' };
  }

  const host = semColchetes(url.hostname);
  if (host === '') {
    return { ok: false, motivo: 'formato' };
  }

  if (ehEnderecoInterno(host)) {
    return { ok: false, motivo: 'interno' };
  }

  const normalizada = normalizarUrl(texto);
  if (normalizada === null) {
    return { ok: false, motivo: 'formato' };
  }

  return { ok: true, normalizada, host };
}
