import { isIP } from 'node:net';
import type { IdRegraEstrutural, RegrasRisco } from './regras.js';
import type { Evidencia } from './tipos.js';

const DESCRICOES: Record<IdRegraEstrutural, { titulo: string; descricao: string }> = {
  ip_no_host: {
    titulo: 'Endereço IP no lugar do nome',
    descricao: 'Sites legítimos usam nomes de domínio. Um IP direto é comum em páginas de golpe.',
  },
  dominio_punycode: {
    titulo: 'Domínio em punycode',
    descricao:
      'O nome usa caracteres codificados (xn--). Pode ser uma imitação de marca com letras parecidas.',
  },
  sem_tls: {
    titulo: 'Conexão sem HTTPS',
    descricao: 'A página não usa conexão criptografada. Dados digitados podem ser interceptados.',
  },
  subdominios_excessivos: {
    titulo: 'Muitos subdomínios',
    descricao:
      'Nomes com muitos níveis costumam esconder a marca verdadeira no começo do endereço.',
  },
  palavra_isca: {
    titulo: 'Palavras típicas de isca',
    descricao:
      'O endereço contém termos usados em páginas de golpe, como login, conta, senha ou verificação.',
  },
  tld_suspeito: {
    titulo: 'Extensão de domínio de alto risco',
    descricao:
      'A extensão do domínio aparece com frequência em campanhas de golpe, por ser barata e fácil de registrar.',
  },
  url_longa: {
    titulo: 'Endereço muito longo',
    descricao:
      'Endereços longos costumam ter parâmetros que escondem o destino real ou imitam outra página.',
  },
  hifens_excessivos: {
    titulo: 'Muitos hífens no domínio',
    descricao:
      'Hífens em excesso são usados para imitar nomes conhecidos com aparência de legítimo.',
  },
};

function tokens(texto: string): string[] {
  return texto
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Cada regra responde se o sinal está presente. O motor usa só o maior peso do grupo. */
function regraDisparada(
  id: IdRegraEstrutural,
  url: URL,
  host: string,
  regras: RegrasRisco,
): boolean {
  const { estrutura } = regras;
  const rotulos = host.split('.');
  const palavras = tokens(`${host} ${url.pathname} ${url.search}`);

  switch (id) {
    case 'ip_no_host':
      return isIP(host) !== 0;
    case 'dominio_punycode':
      return rotulos.some((rotulo) => rotulo.startsWith('xn--'));
    case 'sem_tls':
      return url.protocol === 'http:';
    case 'subdominios_excessivos':
      return rotulos.length >= estrutura.minimoRotulosSubdominio;
    case 'palavra_isca':
      return estrutura.palavrasIsca.some((isca) => palavras.includes(isca));
    case 'tld_suspeito':
      return estrutura.tldsSuspeitos.includes(rotulos.at(-1) ?? '');
    case 'url_longa':
      return url.toString().length > estrutura.comprimentoUrlLongo;
    case 'hifens_excessivos':
      return host.split('-').length - 1 >= estrutura.minimoHifens;
  }
}

/**
 * Sinais estruturais da URL. Só analisa a string, sem acessar o endereço.
 * Devolve uma evidência por regra disparada, com o peso definido em risk-rules.json.
 */
export function avaliarEstrutura(url: URL, host: string, regras: RegrasRisco): Evidencia[] {
  const ids = Object.keys(regras.estrutura.pesos) as IdRegraEstrutural[];

  return ids
    .filter((id) => regraDisparada(id, url, host, regras))
    .map((id) => ({
      grupo: 'E' as const,
      id,
      ...DESCRICOES[id],
      peso: regras.estrutura.pesos[id],
    }));
}
