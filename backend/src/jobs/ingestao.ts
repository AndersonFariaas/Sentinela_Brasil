import { loadEnvServico } from '../config/env-servico.js';
import { criarClienteServico } from '../integrations/supabase/clientes-servico.js';
import { criarRepositorioIngestao } from '../integrations/supabase/repositorio-ingestao.js';
import { criarAdaptador } from '../integrations/threat-feeds/registro-adaptadores.js';
import { executarIngestao } from '../modules/intelligence/ingestao.service.js';

/**
 * Coleta as fontes ativas e grava no banco. Uma linha JSON por evento, sem segredos.
 * Execução: npm run ingestao (dentro de backend/). Sai com código 1 se alguma fonte falhar.
 */
async function main(): Promise<void> {
  const env = loadEnvServico();
  const repositorio = criarRepositorioIngestao(criarClienteServico(env));

  const resumos = await executarIngestao(repositorio, criarAdaptador, (evento, dados) => {
    console.log(JSON.stringify({ evento, ...dados, em: new Date().toISOString() }));
  });

  console.log(JSON.stringify({ evento: 'ingestao.concluida', fontes: resumos }));

  if (resumos.some((resumo) => resumo.status === 'erro')) {
    process.exitCode = 1;
  }
}

await main();
