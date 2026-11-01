import { z } from 'zod';

const API_URL = import.meta.env.VITE_API_URL ?? '';

const respostaSaudeSchema = z.object({ status: z.literal('ok') });

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

    const resultado = respostaSaudeSchema.safeParse(await resposta.json());
    return resultado.success;
  } catch (error) {
    console.error('Falha ao consultar a API', error);
    return false;
  }
}
