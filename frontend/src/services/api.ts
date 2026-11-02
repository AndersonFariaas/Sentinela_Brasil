import { z } from 'zod';

const API_URL = import.meta.env.VITE_API_URL ?? '';

const respostaSaudeSchema = z.object({ status: z.literal('ok') });

const perfilSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  fullName: z.string().nullable(),
  role: z.enum(['user', 'analyst', 'admin']),
});

export type PerfilUsuario = z.infer<typeof perfilSchema>;

/**
 * Erro HTTP da API. A mensagem do Error é para o log do desenvolvedor.
 * `detalhe` é a mensagem segura que o servidor devolve para o usuário (ex.: URL recusada).
 */
export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly detalhe: string | null = null,
  ) {
    super(`Falha na API: HTTP ${String(status)}`);
    this.name = 'ErroApi';
  }
}

const erroServidorSchema = z.object({ error: z.object({ message: z.string() }) });

/** Lê a mensagem segura do corpo de erro, quando o servidor enviou uma. */
export async function lerDetalheErro(resposta: Response): Promise<string | null> {
  try {
    const corpo: unknown = await resposta.json();
    const erro = erroServidorSchema.safeParse(corpo);
    return erro.success ? erro.data.error.message : null;
  } catch {
    return null;
  }
}

/** Envia JSON autenticado (POST). Lança ErroApi com o detalhe do servidor quando houver. */
export async function enviarJsonAutenticado(
  caminho: string,
  token: string,
  corpo: unknown,
): Promise<unknown> {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });

  if (!resposta.ok) {
    throw new ErroApi(resposta.status, await lerDetalheErro(resposta));
  }

  return resposta.json();
}

/**
 * Consulta o endpoint de saúde da API.
 * Retorna false para qualquer falha: rede, status HTTP ou resposta fora do contrato.
 */
export async function verificarSaudeDaApi(): Promise<boolean> {
  try {
    const resposta = await fetch(`${API_URL}/api/v1/health`);

    if (!resposta.ok) {
      return false;
    }

    const corpo: unknown = await resposta.json();
    return respostaSaudeSchema.safeParse(corpo).success;
  } catch (error) {
    console.error('Falha ao consultar a API', error);
    return false;
  }
}

/** Busca o perfil do usuário autenticado. Lança ErroApi se o token for recusado. */
export async function buscarPerfilAtual(token: string): Promise<PerfilUsuario> {
  const resposta = await fetch(`${API_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resposta.ok) {
    throw new ErroApi(resposta.status);
  }

  const corpo: unknown = await resposta.json();
  return perfilSchema.parse(corpo);
}

/**
 * GET autenticado para qualquer caminho da API. Devolve o JSON sem validar: quem chama
 * valida com o schema da resposta esperada. Lança ErroApi para status de erro.
 */
/** Atualiza um recurso com PUT. Lança ErroApi com o detalhe do servidor quando houver. */
export async function atualizarJsonAutenticado(
  caminho: string,
  token: string,
  corpo: unknown,
): Promise<unknown> {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });

  if (!resposta.ok) {
    throw new ErroApi(resposta.status, await lerDetalheErro(resposta));
  }

  return resposta.json();
}

/** Remove um recurso com DELETE. A API responde 204, sem corpo. */
export async function excluirAutenticado(caminho: string, token: string): Promise<void> {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resposta.ok) {
    throw new ErroApi(resposta.status, await lerDetalheErro(resposta));
  }
}

export async function obterJsonAutenticado(caminho: string, token: string): Promise<unknown> {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resposta.ok) {
    throw new ErroApi(resposta.status);
  }

  return resposta.json();
}
