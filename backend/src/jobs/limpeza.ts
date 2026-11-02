import { loadEnvServico } from '../config/env-servico.js';
import { criarClienteServico } from '../integrations/supabase/clientes-servico.js';
import { criarRepositorioRetencao } from '../integrations/supabase/repositorio-retencao.js';
import { executarLimpeza } from '../modules/retention/limpeza.service.js';

/**
 * Aplica os prazos de retenção (database.md §6).
 * Sem argumento, só mostra quantos registros seriam apagados. Com --executar, apaga de fato.
 * Execução: npm run limpeza (conta) ou npm run limpeza -- --executar (apaga).
 */
async function main(): Promise<void> {
  const executar = process.argv.includes('--executar');
  const env = loadEnvServico();
  const cliente = criarClienteServico(env);

  const resumo = await executarLimpeza(criarRepositorioRetencao(cliente), new Date(), executar);

  console.log(JSON.stringify({ evento: 'limpeza.concluida', ...resumo }));
}

main().catch((erro: unknown) => {
  const motivo = erro instanceof Error ? erro.message : 'erro desconhecido';
  console.error(JSON.stringify({ evento: 'limpeza.falhou', motivo }));
  process.exitCode = 1;
});
