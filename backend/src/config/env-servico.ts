import { z } from 'zod';

const envServicoSchema = z.object({
  SUPABASE_URL: z.url(),
  // Chave com acesso total ao banco. Só o servidor pode ler esta variável.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type EnvServico = z.output<typeof envServicoSchema>;

/** Variáveis das tarefas do servidor (ingestão). Mesma regra do loadEnv: nunca mostra valores. */
export function loadEnvServico(source: NodeJS.ProcessEnv = process.env): EnvServico {
  const resultado = envServicoSchema.safeParse(source);

  if (!resultado.success) {
    const invalidas = resultado.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Configuração inválida nas variáveis de ambiente: ${invalidas}`);
  }

  return resultado.data;
}
