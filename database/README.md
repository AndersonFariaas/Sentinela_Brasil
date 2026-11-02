# Banco de dados (Supabase / PostgreSQL)

As migrations em `migrations/` são a fonte da verdade do schema. Elas são aplicadas em ordem numérica.

| Arquivo                                   | Conteúdo                                                                                        |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `0001_profiles_and_roles.sql`             | `profiles`, trigger de cadastro, `is_admin()` e privilégio de coluna que protege o papel        |
| `0002_threat_intelligence_data.sql`       | `sources`, `threats`, `indicators`, `threat_indicators`, `threat_revisions`, `ingestion_runs`   |
| `0003_user_data_and_audit.sql`            | `scans`, `analyses`, `alerts`, `subscriptions`, `audit_log`                                     |
| `0004_private_helpers_and_fk_indexes.sql` | Move `is_admin()` para o schema `private` (fora da API) e indexa FKs                            |
| `0005_seed_threat_sources.sql`            | Fontes iniciais: CISA KEV (ativa), URLhaus e CERT.br (inativas até termos e chave)              |
| `0006_scan_registration.sql`              | `registrar_escaneamento()`: grava scan e análise para `auth.uid()`, sem service_role na API     |
| `0007_cancelar_inscricao.sql`             | `cancelar_inscricao()`: desativa uma inscrição pelo id, para o link do e-mail, sem service_role |

## Como aplicar

Em um projeto novo, rode os arquivos em ordem no SQL Editor do Supabase, ou com o Supabase CLI.

Em produção, aplique só com confirmação do responsável pelo projeto. Migrations aplicadas não são editadas: a correção vai em um arquivo novo.

## Regras de segurança do schema

- RLS ativo em todas as tabelas de `public`.
- `anon` não tem nenhum privilégio. `authenticated` recebe só o mínimo.
- Dados gerados pelo servidor (`scans`, `analyses`, `alerts`) não aceitam INSERT nem UPDATE de cliente. Quem grava é o back-end com `service_role`, após validar o token.
- `profiles.role` não pode ser alterado pelo usuário (privilégio de coluna).
- Funções de trigger não são executáveis pela API REST.

## Testes

- Verificação do RLS: `npm run test:integration` em `backend/`. Exige `SUPABASE_SERVICE_ROLE_KEY` no `.env` local e cria/apaga usuários de teste no projeto indicado.
