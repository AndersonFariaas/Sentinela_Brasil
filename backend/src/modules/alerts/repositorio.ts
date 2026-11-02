import type { CategoriaAmeaca } from '../intelligence/tipos.js';
import type { AmeacaAlerta } from './template.js';

export interface AlertaPendente {
  id: string;
  chaveIdempotencia: string;
  tentativas: number;
  destinatario: string;
  ameaca: AmeacaAlerta;
  /** Inscrição que originou o alerta. Null quando ela já foi cancelada depois da criação. */
  inscricaoId: string | null;
}

/** Contrato de persistência dos alertas. A implementação com Supabase fica em integrations/supabase. */
export interface RepositorioAlertas {
  /** Ameaças verificadas criadas a partir de `desde` (ISO 8601). */
  buscarAmeacasConfirmadas(desde: string): Promise<AmeacaAlerta[]>;
  /** Usuários com inscrição ativa na categoria. */
  buscarInscritos(categoria: CategoriaAmeaca): Promise<string[]>;
  /** Cria um alerta pendente por usuário. Os já existentes são ignorados. Devolve quantos foram criados. */
  criarAlertas(ameacaId: string, usuarioIds: string[]): Promise<number>;
  /** Alertas pendentes com menos tentativas que o limite, com e-mail e ameaça prontos para envio. */
  listarAlertasPendentes(limite: number, tentativasMaximas: number): Promise<AlertaPendente[]>;
  registrarEnvio(alertaId: string, messageId: string, tentativas: number): Promise<void>;
  registrarFalha(alertaId: string, tentativas: number, mensagem: string): Promise<void>;
  /** Alerta de inscrição já cancelada: não é enviado. */
  cancelarAlerta(alertaId: string): Promise<void>;
}
