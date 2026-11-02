import { z } from 'zod';
import {
  CATEGORIAS_AMEACA,
  SEVERIDADES,
  type CategoriaAmeaca,
} from '../../modules/intelligence/tipos.js';
import type { AlertaPendente, RepositorioAlertas } from '../../modules/alerts/repositorio.js';
import type { AmeacaAlerta } from '../../modules/alerts/template.js';
import type { ClienteSupabase } from './clientes.js';

const TAMANHO_BLOCO_GRAVACAO = 500;
const LIMITE_AMEACAS_POR_EXECUCAO = 500;
const TAMANHO_MAXIMO_ERRO = 500;
const TIPO_ALERTA = 'nova_ameaca';

// Validação na fronteira: o que volta do banco precisa bater com o contrato antes de virar e-mail.
const ameacaLinhaSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  category: z.enum(CATEGORIAS_AMEACA),
  severity: z.enum(SEVERIDADES),
  cve_id: z.string().nullable(),
  source_url: z.string().nullable(),
});

const ameacaParaAlerta = (linha: z.output<typeof ameacaLinhaSchema>): AmeacaAlerta => ({
  id: linha.id,
  titulo: linha.title,
  descricao: linha.description,
  categoria: linha.category,
  severidade: linha.severity,
  cveId: linha.cve_id,
  urlFonte: linha.source_url,
});

function emBlocos<T>(itens: readonly T[], tamanho: number): T[][] {
  const blocos: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    blocos.push(itens.slice(i, i + tamanho));
  }
  return blocos;
}

function garantirSemErro(erro: { message: string } | null, contexto: string): void {
  if (erro) {
    throw new Error(`${contexto}: ${erro.message}`);
  }
}

/** Mesma chave que a restrição `alerts_idempotency_key` do banco exige. */
function chaveIdempotencia(usuarioId: string, ameacaId: string): string {
  return `alert:${usuarioId}:${ameacaId}:${TIPO_ALERTA}`;
}

export function criarRepositorioAlertas(cliente: ClienteSupabase): RepositorioAlertas {
  return {
    async buscarAmeacasConfirmadas(desde) {
      const { data, error } = await cliente
        .from('threats')
        .select('id, title, description, category, severity, cve_id, source_url')
        .eq('verification_status', 'verificada')
        .gte('created_at', desde)
        .limit(LIMITE_AMEACAS_POR_EXECUCAO);
      garantirSemErro(error, 'Falha ao buscar ameaças verificadas');

      return (data ?? []).map((linha) => ameacaParaAlerta(ameacaLinhaSchema.parse(linha)));
    },

    async buscarInscritos(categoria: CategoriaAmeaca) {
      const { data, error } = await cliente
        .from('subscriptions')
        .select('user_id')
        .eq('category', categoria)
        .eq('enabled', true);
      garantirSemErro(error, 'Falha ao buscar inscrições');

      return (data ?? []).map((linha) => linha.user_id);
    },

    async criarAlertas(ameacaId, usuarioIds) {
      const linhas = usuarioIds.map((usuarioId) => ({
        user_id: usuarioId,
        threat_id: ameacaId,
        alert_type: TIPO_ALERTA,
        idempotency_key: chaveIdempotencia(usuarioId, ameacaId),
      }));

      let criados = 0;
      for (const bloco of emBlocos(linhas, TAMANHO_BLOCO_GRAVACAO)) {
        // Com ignoreDuplicates, o retorno traz só as linhas realmente inseridas.
        const { data, error } = await cliente
          .from('alerts')
          .upsert(bloco, { onConflict: 'user_id,threat_id,alert_type', ignoreDuplicates: true })
          .select('id');
        garantirSemErro(error, 'Falha ao criar alertas');
        criados += data?.length ?? 0;
      }

      return criados;
    },

    async listarAlertasPendentes(limite, tentativasMaximas) {
      const { data: alertas, error: erroAlertas } = await cliente
        .from('alerts')
        .select('id, idempotency_key, attempts, user_id, threat_id')
        .eq('delivery_status', 'pendente')
        .lt('attempts', tentativasMaximas)
        .order('created_at', { ascending: true })
        .limit(limite);
      garantirSemErro(erroAlertas, 'Falha ao listar alertas pendentes');

      if (!alertas || alertas.length === 0) {
        return [];
      }

      const usuarioIds = [...new Set(alertas.map((alerta) => alerta.user_id))];
      const ameacaIds = [...new Set(alertas.map((alerta) => alerta.threat_id))];

      const { data: perfis, error: erroPerfis } = await cliente
        .from('profiles')
        .select('id, email')
        .in('id', usuarioIds);
      garantirSemErro(erroPerfis, 'Falha ao ler destinatários');

      const { data: ameacas, error: erroAmeacas } = await cliente
        .from('threats')
        .select('id, title, description, category, severity, cve_id, source_url')
        .in('id', ameacaIds);
      garantirSemErro(erroAmeacas, 'Falha ao ler ameaças dos alertas');

      const emailPorUsuario = new Map((perfis ?? []).map((perfil) => [perfil.id, perfil.email]));
      const ameacaPorId = new Map(
        (ameacas ?? []).map((linha) => {
          const ameaca = ameacaParaAlerta(ameacaLinhaSchema.parse(linha));
          return [ameaca.id, ameaca];
        }),
      );

      return alertas.flatMap((alerta): AlertaPendente[] => {
        const destinatario = emailPorUsuario.get(alerta.user_id);
        const ameaca = ameacaPorId.get(alerta.threat_id);

        // Sem destinatário ou ameaça, o alerta não tem como ser enviado. Fica pendente e é ignorado aqui.
        if (!destinatario || !ameaca) {
          return [];
        }

        return [
          {
            id: alerta.id,
            chaveIdempotencia: alerta.idempotency_key,
            tentativas: alerta.attempts,
            destinatario,
            ameaca,
          },
        ];
      });
    },

    async registrarEnvio(alertaId, messageId, tentativas) {
      const { error } = await cliente
        .from('alerts')
        .update({
          delivery_status: 'enviado',
          resend_message_id: messageId,
          attempts: tentativas,
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', alertaId);
      garantirSemErro(error, 'Falha ao registrar envio do alerta');
    },

    async registrarFalha(alertaId, tentativas, mensagem) {
      const { error } = await cliente
        .from('alerts')
        .update({
          delivery_status: 'falhou',
          attempts: tentativas,
          last_error: mensagem.slice(0, TAMANHO_MAXIMO_ERRO),
        })
        .eq('id', alertaId);
      garantirSemErro(error, 'Falha ao registrar falha do alerta');
    },
  };
}
