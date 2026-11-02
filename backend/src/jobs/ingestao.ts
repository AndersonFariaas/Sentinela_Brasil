import { loadEnvServico, type EnvServico } from '../config/env-servico.js';
import { criarProvedorEmailResend } from '../integrations/resend/cliente-resend.js';
import { criarClienteServico } from '../integrations/supabase/clientes-servico.js';
import type { ClienteSupabase } from '../integrations/supabase/clientes.js';
import { criarRepositorioAlertas } from '../integrations/supabase/repositorio-alertas.js';
import { criarRepositorioIngestao } from '../integrations/supabase/repositorio-ingestao.js';
import { criarAdaptador } from '../integrations/threat-feeds/registro-adaptadores.js';
import { dispararAlertas } from '../modules/alerts/alertas.service.js';
import { executarIngestao, type Registrador } from '../modules/intelligence/ingestao.service.js';

const registrar: Registrador = (evento, dados) => {
  console.log(JSON.stringify({ evento, ...dados, em: new Date().toISOString() }));
};

/** Sem chave da Resend, os alertas ficam desativados e a coleta segue normalmente. */
async function enviarAlertas(env: EnvServico, cliente: ClienteSupabase): Promise<void> {
  const chave = env.RESEND_API_KEY?.trim();
  if (!chave) {
    registrar('alertas.desativados', { motivo: 'RESEND_API_KEY ausente' });
    return;
  }

  await dispararAlertas(criarRepositorioAlertas(cliente), {
    provedor: criarProvedorEmailResend({
      apiKey: chave,
      remetente: env.ALERTA_REMETENTE || undefined,
    }),
    agora: new Date(),
    registrar,
  });
}

/**
 * Coleta as fontes ativas, grava no banco e envia os alertas das ameaças novas.
 * Execução: npm run ingestao (dentro de backend/). Sai com código 1 se alguma fonte falhar.
 */
async function main(): Promise<void> {
  const env = loadEnvServico();
  const cliente = criarClienteServico(env);
  const repositorio = criarRepositorioIngestao(cliente);

  const resumos = await executarIngestao(repositorio, criarAdaptador, registrar);

  console.log(JSON.stringify({ evento: 'ingestao.concluida', fontes: resumos }));

  await enviarAlertas(env, cliente);

  if (resumos.some((resumo) => resumo.status === 'erro')) {
    process.exitCode = 1;
  }
}

await main();
