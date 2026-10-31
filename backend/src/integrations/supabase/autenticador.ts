import { z } from 'zod';
import type { Env } from '../../config/env.js';
import { PAPEIS, type Autenticador } from '../../modules/auth/auth.types.js';
import { criarClienteAnonimo, criarClienteDoUsuario } from './clientes.js';

// Valida a linha do banco antes de usá-la. Se o contrato mudar, falha alto em vez de dados errados.
const linhaPerfilSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  full_name: z.string().nullable(),
  role: z.enum(PAPEIS),
});

type ConfigSupabase = Pick<Env, 'SUPABASE_URL' | 'SUPABASE_ANON_KEY'>;

export function criarAutenticadorSupabase(config: ConfigSupabase): Autenticador {
  const anonimo = criarClienteAnonimo(config);

  return {
    async verificarToken(token) {
      // Qualquer erro do Auth é tratado como token não aceito: falha fechada, sem acesso.
      const { data, error } = await anonimo.auth.getUser(token);

      if (error) {
        return null;
      }

      return { id: data.user.id, email: data.user.email ?? '' };
    },

    async buscarPerfil(token, usuarioId) {
      const cliente = criarClienteDoUsuario(config, token);
      const { data, error } = await cliente
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('id', usuarioId)
        .maybeSingle();

      if (error) {
        throw new Error(`Falha ao buscar perfil no Supabase: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      const linha: unknown = data;
      const perfil = linhaPerfilSchema.parse(linha);

      return {
        id: perfil.id,
        email: perfil.email,
        fullName: perfil.full_name,
        role: perfil.role,
      };
    },
  };
}
