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

/** Erro HTTP da API. A mensagem é para o log do desenvolvedor, não para o usuário. */
export class ErroApi extends Error {
  constructor(readonly status: number) {
    super(`Falha na API: HTTP ${String(status)}`);
    this.name = 'ErroApi';
  }
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
