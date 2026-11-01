import type { ZodError } from 'zod';

/** Converte os erros do Zod em uma mensagem por campo. Guarda só a primeira de cada campo. */
export function errosPorCampo(erro: ZodError): Record<string, string> {
  const mensagens: Record<string, string> = {};

  for (const problema of erro.issues) {
    const campo = String(problema.path[0] ?? 'formulario');
    mensagens[campo] ??= problema.message;
  }

  return mensagens;
}
