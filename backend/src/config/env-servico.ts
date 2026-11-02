import { z } from 'zod';

const envServicoSchema = z.object({
  SUPABASE_URL: z.url(),
  // Chave com acesso total ao banco. Só o servidor pode ler esta variável.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Opcionais: sem a chave da Resend, a coleta roda e os alertas ficam desativados.
  // O job trata chave vazia como ausente, porque o .env costuma trazer a linha sem valor.
  RESEND_API_KEY: z.string().optional(),
  ALERTA_REMETENTE: z.string().optional(),
  // Base pública da API, usada no link de cancelamento. Sem ela, o alerta não é enviado.
  URL_PUBLICA_API: z.string().optional(),
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
