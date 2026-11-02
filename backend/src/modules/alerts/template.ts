import type { CategoriaAmeaca, Severidade } from '../intelligence/tipos.js';
import type { MensagemEmail } from './envio.js';

export interface AmeacaAlerta {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: CategoriaAmeaca;
  severidade: Severidade;
  cveId: string | null;
  urlFonte: string | null;
}

const ROTULOS_CATEGORIA: Record<CategoriaAmeaca, string> = {
  phishing: 'Phishing',
  malware: 'Malware',
  ransomware: 'Ransomware',
  malicious_domain: 'Domínio malicioso',
  suspicious_url: 'URL suspeita',
  digital_fraud: 'Fraude digital',
  exploited_vulnerability: 'Vulnerabilidade explorada',
};

const ROTULOS_SEVERIDADE: Record<Severidade, string> = {
  baixo: 'Baixa',
  moderado: 'Moderada',
  alto: 'Alta',
  critico: 'Crítica',
};

const LIMITE_DESCRICAO = 300;
const LIMITE_ASSUNTO = 120;

const ESCAPES_HTML: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Texto vindo de feeds externos é dado, não markup. Todo campo passa por aqui antes do HTML. */
export function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (caractere) => ESCAPES_HTML[caractere] ?? caractere);
}

function truncar(texto: string, limite: number): string {
  return texto.length <= limite ? texto : `${texto.slice(0, limite - 1)}…`;
}

// Quebras de linha no assunto permitem injetar cabeçalhos. Troca tudo por espaço.
function assuntoSeguro(titulo: string): string {
  return truncar(`Nova ameaça: ${titulo}`.replace(/[\r\n]+/g, ' '), LIMITE_ASSUNTO);
}

function linhaCve(ameaca: AmeacaAlerta): string {
  return ameaca.cveId ? ` · CVE: ${ameaca.cveId}` : '';
}

function blocoFonte(ameaca: AmeacaAlerta): string {
  if (!ameaca.urlFonte) {
    return '';
  }

  // Só links https chegam aqui (constraint da tabela threats). O atributo ainda é escapado.
  return `<p style="margin:0 0 24px;">
      <a href="${escaparHtml(ameaca.urlFonte)}" rel="noopener noreferrer"
         style="display:inline-block;min-height:44px;line-height:44px;padding:0 20px;background:#1a1a1a;color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;">
        Ver fonte oficial
      </a>
    </p>`;
}

function montarHtml(ameaca: AmeacaAlerta, assunto: string): string {
  const titulo = escaparHtml(ameaca.titulo);
  const categoria = escaparHtml(ROTULOS_CATEGORIA[ameaca.categoria]);
  const severidade = escaparHtml(ROTULOS_SEVERIDADE[ameaca.severidade]);
  const cve = escaparHtml(linhaCve(ameaca));
  const descricao = escaparHtml(truncar(ameaca.descricao ?? '', LIMITE_DESCRICAO));

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escaparHtml(assunto)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;">
      <tr>
        <td align="center" style="padding:16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;">
            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#555555;">SENTINELA · Nova ameaça</p>
                <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;">${titulo}</h1>
                <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#555555;">Categoria: ${categoria} · Severidade: ${severidade}${cve}</p>
                <p style="margin:0 0 20px;font-size:16px;line-height:1.5;">${descricao}</p>
                ${blocoFonte(ameaca)}
                <p style="margin:0;font-size:12px;line-height:1.5;color:#666666;">Você recebeu este e-mail porque está inscrito em alertas de ${categoria} no SENTINELA.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function montarTexto(ameaca: AmeacaAlerta): string {
  const linhas = [
    'SENTINELA · Nova ameaça',
    '',
    ameaca.titulo,
    `Categoria: ${ROTULOS_CATEGORIA[ameaca.categoria]} · Severidade: ${ROTULOS_SEVERIDADE[ameaca.severidade]}${linhaCve(ameaca)}`,
    '',
    truncar(ameaca.descricao ?? '', LIMITE_DESCRICAO),
  ];

  if (ameaca.urlFonte) {
    linhas.push('', `Fonte oficial: ${ameaca.urlFonte}`);
  }

  linhas.push(
    '',
    `Você recebeu este e-mail porque está inscrito em alertas de ${ROTULOS_CATEGORIA[ameaca.categoria]} no SENTINELA.`,
  );
  return linhas.join('\n');
}

export function montarEmailAlerta(ameaca: AmeacaAlerta, destinatario: string): MensagemEmail {
  const assunto = assuntoSeguro(ameaca.titulo);

  return {
    para: destinatario,
    assunto,
    html: montarHtml(ameaca, assunto),
    texto: montarTexto(ameaca),
  };
}
