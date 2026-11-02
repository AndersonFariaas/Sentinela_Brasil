import Anthropic, { APIConnectionTimeoutError, APIUserAbortError } from '@anthropic-ai/sdk';
import { ErroProvedorIa, type ProvedorIa } from '../../modules/ai-analyst/provedor.js';

export interface ConfigAnthropic {
  apiKey: string;
  modelo: string;
}

// Com o Claude Opus 5.5 o raciocínio interno é sempre ativo e conta neste limite,
// então um teto baixo cortaria o JSON no meio.
const LIMITE_TOKENS_RESPOSTA = 4000;

/**
 * Adaptador do SDK oficial. Só este arquivo conhece a API da Anthropic.
 * Erros são traduzidos para ErroProvedorIa, sem repassar o corpo da resposta nem a chave.
 */
export function criarProvedorAnthropic(config: ConfigAnthropic): ProvedorIa {
  const cliente = new Anthropic({ apiKey: config.apiKey, maxRetries: 1 });

  return {
    nome: 'anthropic',
    modelo: config.modelo,
    async gerarTexto({ sistema, usuario, signal }) {
      try {
        const resposta = await cliente.messages.create(
          {
            model: config.modelo,
            max_tokens: LIMITE_TOKENS_RESPOSTA,
            system: sistema,
            messages: [{ role: 'user', content: usuario }],
            output_config: { effort: 'medium' },
          },
          { signal },
        );

        if (resposta.stop_reason === 'refusal') {
          throw new ErroProvedorIa('recusa');
        }

        return resposta.content
          .flatMap((bloco) => (bloco.type === 'text' ? [bloco.text] : []))
          .join('');
      } catch (falha) {
        throw traduzirErro(falha, signal);
      }
    },
  };
}

function traduzirErro(falha: unknown, signal: AbortSignal): ErroProvedorIa {
  if (falha instanceof ErroProvedorIa) {
    return falha;
  }

  const expirou =
    signal.aborted ||
    falha instanceof APIConnectionTimeoutError ||
    falha instanceof APIUserAbortError;

  return new ErroProvedorIa(expirou ? 'tempo_esgotado' : 'erro_provedor');
}

/** Modelo padrão do analista. Troque por IA_MODELO só com decisão do time. */
export const MODELO_IA_PADRAO = 'claude-haiku-5-5';
export const TIMEOUT_IA_PADRAO_MS = 15_000;

/** Sem chave, devolve null: o analista responde só com o texto determinístico. */
export function criarProvedorIaPadrao(env: {
  ANTHROPIC_API_KEY?: string | undefined;
  IA_MODELO?: string | undefined;
}): ProvedorIa | null {
  if (!env.ANTHROPIC_API_KEY) {
    return null;
  }

  return criarProvedorAnthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    modelo: env.IA_MODELO ?? MODELO_IA_PADRAO,
  });
}
