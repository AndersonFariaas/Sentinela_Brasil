import { z } from 'zod';
import { CATEGORIAS } from '@/constantes/ameacas';
import { atualizarJsonAutenticado, obterJsonAutenticado } from './api';

const inscricaoSchema = z.object({
  categoria: z.enum(CATEGORIAS),
  ativa: z.boolean(),
});

const listaInscricoesSchema = z.object({
  inscricoes: z.array(inscricaoSchema),
});

export type Inscricao = z.infer<typeof inscricaoSchema>;

/** Todas as categorias, cada uma com o estado de inscrição do usuário. */
export async function listarInscricoes(token: string): Promise<Inscricao[]> {
  const corpo = await obterJsonAutenticado('/api/v1/alertas/inscricoes', token);
  return listaInscricoesSchema.parse(corpo).inscricoes;
}

/** Liga ou desliga os alertas de uma categoria. Devolve o estado gravado pelo servidor. */
export async function definirInscricao(
  token: string,
  categoria: Inscricao['categoria'],
  ativa: boolean,
): Promise<Inscricao> {
  const corpo = await atualizarJsonAutenticado(
    `/api/v1/alertas/inscricoes/${encodeURIComponent(categoria)}`,
    token,
    { ativa },
  );
  return inscricaoSchema.parse(corpo);
}
