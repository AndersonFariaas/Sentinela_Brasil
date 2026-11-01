import { ErroColeta } from '../../modules/intelligence/erros.js';

export interface OpcoesBusca {
  timeoutMs: number;
  tamanhoMaximoBytes: number;
  /** Única lista de hosts que o servidor pode consultar para coletar dados. */
  hostsPermitidos: readonly string[];
}

type FuncaoFetch = (url: URL, init: RequestInit) => Promise<Response>;

/**
 * Busca um texto em uma fonte permitida.
 * Recusa host fora da lista e redirecionamentos (um redirect poderia levar a um destino interno),
 * aplica tempo limite e corta respostas acima do tamanho máximo.
 */
export async function buscarTextoSeguro(
  endereco: string,
  opcoes: OpcoesBusca,
  fetchImpl: FuncaoFetch = (url, init) => fetch(url, init),
): Promise<string> {
  const destino = new URL(endereco);

  if (destino.protocol !== 'https:') {
    throw new ErroColeta('A fonte precisa usar HTTPS.');
  }

  if (!opcoes.hostsPermitidos.includes(destino.hostname)) {
    throw new ErroColeta(`Host não permitido para coleta: ${destino.hostname}`);
  }

  const resposta = await fetchImpl(destino, {
    redirect: 'error',
    signal: AbortSignal.timeout(opcoes.timeoutMs),
  });

  if (!resposta.ok) {
    throw new ErroColeta(`A fonte respondeu com HTTP ${String(resposta.status)}.`);
  }

  return lerComLimite(resposta, opcoes.tamanhoMaximoBytes);
}

/**
 * Recusa pelo Content-Length declarado, quando existe, e confere o tamanho real depois.
 * O tempo limite já impede downloads longos. Um streaming com corte no meio exigiria
 * tipos mais finos da API de stream; fica como melhoria se a fonte mudar de porte.
 */
async function lerComLimite(resposta: Response, limiteBytes: number): Promise<string> {
  const declarado = Number(resposta.headers.get('content-length') ?? '0');
  if (declarado > limiteBytes) {
    throw new ErroColeta('A resposta da fonte passou do tamanho máximo permitido.');
  }

  const corpo = Buffer.from(await resposta.arrayBuffer());
  if (corpo.byteLength > limiteBytes) {
    throw new ErroColeta('A resposta da fonte passou do tamanho máximo permitido.');
  }

  return corpo.toString('utf8');
}
