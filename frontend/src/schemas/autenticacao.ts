import { z } from 'zod';

// Espelha as regras do servidor. O servidor continua sendo a fonte da verdade.
const SENHA_MINIMA = 8;
const SENHA_MAXIMA = 128;

const emailSchema = z.email({ error: 'Informe um e-mail válido.' }).max(254);

export const entrarSchema = z.object({
  email: emailSchema,
  senha: z.string().min(1, { error: 'Informe a senha.' }),
});

export const cadastroSchema = z
  .object({
    email: emailSchema,
    senha: z
      .string()
      .min(SENHA_MINIMA, {
        error: `A senha precisa ter pelo menos ${String(SENHA_MINIMA)} caracteres.`,
      })
      .max(SENHA_MAXIMA, {
        error: `A senha pode ter no máximo ${String(SENHA_MAXIMA)} caracteres.`,
      }),
    confirmarSenha: z.string(),
  })
  .refine((dados) => dados.senha === dados.confirmarSenha, {
    error: 'As senhas não coincidem.',
    path: ['confirmarSenha'],
  });

export type EntrarDados = z.infer<typeof entrarSchema>;
export type CadastroDados = z.infer<typeof cadastroSchema>;
