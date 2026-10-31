# SENTINELA — Modelo de dados

**Status:** proposta para aprovação (Fase 0). SQL final vai para `database/migrations/` na Fase 2.
**Data:** 31/10/2026
**Escrito para:** integrantes que escrevem migrations, back-end e testes de RLS.

---

## 1. Ajustes em relação ao escopo

O escopo lista oito tabelas. Esta proposta mantém essas tabelas e faz quatro mudanças:

1. **Indicadores são globais e únicos** por `(tipo, valor)`, ligados às ameaças por tabela de junção `threat_indicators`. Um mesmo domínio pode aparecer em várias ameaças. Com `threat_id` direto na tabela, a mesma URL seria duplicada.
2. **`scans` e `analyses` se complementam, sem sobrepor.** `scans` guarda a verificação da URL. `analyses` guarda a explicação da IA, ligada a um scan por `scan_id`. Na proposta original, `analyses.target` repetia dados de `scans`.
3. **`alerts` e `subscriptions` têm restrições de unicidade** para impedir alerta duplicado.
4. **Tabelas de apoio** para rastreabilidade e auditoria, exigidas pelo escopo: `threat_revisions` (histórico de atualizações), `ingestion_runs` (execuções de coleta) e `audit_log` (ações sensíveis).

Pergunta para o time: `POST /api/v1/alerts` do escopo fica ambíguo. **Recomendação:** esse endpoint cria ou altera uma inscrição (`subscriptions`). O envio de e-mail nunca é disparado por requisição direta do usuário. Isso evita uso do sistema como remetente de spam.

---

## 2. Diagrama (resumo)

```
auth.users ──1:1── profiles
    │
    ├──1:N── scans ──1:1── analyses
    ├──1:N── alerts ─────N:1── threats
    └──1:N── subscriptions

sources ──1:N── threats ──N:M── indicators   (via threat_indicators)
   │                │
   │                └──1:N── threat_revisions
   └──1:N── ingestion_runs

audit_log   (sem FK obrigatória; registra ações de qualquer ator)
```

---

## 3. Tabelas

Tipos de enumeração são implementados com `text` + `CHECK`, o que facilita evoluir os valores sem migrar tipos enumerados do Postgres.

### 3.1 `profiles`

| Coluna                      | Tipo          | Regras                                                               |
| --------------------------- | ------------- | -------------------------------------------------------------------- |
| `id`                        | `uuid`        | PK, FK para `auth.users(id)` `ON DELETE CASCADE`                     |
| `full_name`                 | `text`        | `CHECK (char_length(full_name) BETWEEN 2 AND 120)`                   |
| `email`                     | `text`        | Cópia do e-mail do Auth, sincronizada por trigger                    |
| `role`                      | `text`        | `NOT NULL DEFAULT 'user' CHECK (role IN ('user','analyst','admin'))` |
| `created_at` / `updated_at` | `timestamptz` | `DEFAULT now()`                                                      |

- Trigger `AFTER INSERT ON auth.users` cria a linha em `profiles`.
- **Escalada de privilégio:** o usuário não pode alterar `role`. Isso é feito com privilégio de coluna, não só com política:
  ```sql
  REVOKE UPDATE ON profiles FROM authenticated;
  GRANT UPDATE (full_name) ON profiles TO authenticated;
  ```
  Alterar `role` fica restrito ao `service_role`, usado em script administrativo.

### 3.2 `sources`

| Coluna                              | Tipo          | Regras                                                                |
| ----------------------------------- | ------------- | --------------------------------------------------------------------- |
| `id`                                | `uuid`        | PK                                                                    |
| `name`                              | `text`        | `NOT NULL`, `UNIQUE`                                                  |
| `source_type`                       | `text`        | `CHECK (source_type IN ('api','feed_json','feed_rss','html'))`        |
| `base_url`                          | `text`        | `NOT NULL`, `https` obrigatório (`CHECK (base_url LIKE 'https://%')`) |
| `description`                       | `text`        |                                                                       |
| `reliability`                       | `smallint`    | `CHECK (reliability BETWEEN 1 AND 5)`                                 |
| `terms_url`                         | `text`        | Link para termos de uso ou licença da fonte                           |
| `is_active`                         | `boolean`     | `DEFAULT true`                                                        |
| `consecutive_failures`              | `integer`     | `DEFAULT 0`, `CHECK (>= 0)`                                           |
| `last_success_at` / `last_error_at` | `timestamptz` |                                                                       |
| `last_error_summary`                | `text`        | Resumo curto, sem corpo de resposta nem cabeçalhos                    |
| `created_at` / `updated_at`         | `timestamptz` |                                                                       |

Fontes iniciais: CISA KEV (`feed_json`), URLhaus (`api`), CERT.br (`html` via Firecrawl, com feed RSS como fonte de descoberta a confirmar no site oficial).

### 3.3 `threats`

| Coluna                      | Tipo          | Regras                                                                                                                                  |
| --------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                        | `uuid`        | PK                                                                                                                                      |
| `dedupe_key`                | `text`        | `NOT NULL UNIQUE`. Formato: `{source_id}:{external_id}`                                                                                 |
| `external_id`               | `text`        | Identificador na fonte (ex.: CVE, id do URLhaus)                                                                                        |
| `title`                     | `text`        | `NOT NULL`, máximo 300 caracteres                                                                                                       |
| `description`               | `text`        | Texto da fonte, tratado como dado não confiável                                                                                         |
| `category`                  | `text`        | `CHECK (category IN ('phishing','malware','ransomware','malicious_domain','suspicious_url','digital_fraud','exploited_vulnerability'))` |
| `severity`                  | `text`        | `CHECK (severity IN ('baixo','moderado','alto','critico'))`                                                                             |
| `verification_status`       | `text`        | `CHECK (verification_status IN ('nao_verificada','verificada','descartada'))`                                                           |
| `cve_id`                    | `text`        | `CHECK (cve_id IS NULL OR cve_id ~ '^CVE-\d{4}-\d{4,}$')`                                                                               |
| `source_id`                 | `uuid`        | FK `sources(id)`, `NOT NULL`, `ON DELETE RESTRICT`                                                                                      |
| `source_url`                | `text`        | Link de origem para o usuário conferir                                                                                                  |
| `published_at`              | `timestamptz` | Data informada pela fonte                                                                                                               |
| `collected_at`              | `timestamptz` | `NOT NULL`                                                                                                                              |
| `last_verified_at`          | `timestamptz` | Última vez que a coleta confirmou o registro                                                                                            |
| `created_at` / `updated_at` | `timestamptz` |                                                                                                                                         |

`status` do escopo foi renomeado para `verification_status` para não confundir com o estado da execução. Ajustar se o time preferir o nome original.

### 3.4 `indicators`

| Coluna                           | Tipo          | Regras                                                           |
| -------------------------------- | ------------- | ---------------------------------------------------------------- |
| `id`                             | `uuid`        | PK                                                               |
| `indicator_type`                 | `text`        | `CHECK (indicator_type IN ('domain','url','ip','sha256','cve'))` |
| `indicator_value`                | `text`        | Valor normalizado na gravação                                    |
| `confidence`                     | `smallint`    | `CHECK (confidence BETWEEN 0 AND 100)`                           |
| `first_seen_at` / `last_seen_at` | `timestamptz` |                                                                  |
| `source_id`                      | `uuid`        | FK `sources(id)`                                                 |
| `created_at`                     | `timestamptz` |                                                                  |

- `UNIQUE (indicator_type, indicator_value)`.
- Normalização: domínio em minúsculas e punycode, sem ponto final; URL com esquema, host normalizado e sem fragmento; IP na forma canônica; hash em minúsculas.

### 3.5 `threat_indicators`

| Coluna         | Tipo   | Regras                                  |
| -------------- | ------ | --------------------------------------- |
| `threat_id`    | `uuid` | FK `threats(id)` `ON DELETE CASCADE`    |
| `indicator_id` | `uuid` | FK `indicators(id)` `ON DELETE CASCADE` |
|                |        | `PRIMARY KEY (threat_id, indicator_id)` |

### 3.6 `threat_revisions`

Histórico de mudanças em uma ameaça.

| Coluna             | Tipo          | Regras                               |
| ------------------ | ------------- | ------------------------------------ |
| `id`               | `bigint`      | PK identity                          |
| `threat_id`        | `uuid`        | FK `threats(id)` `ON DELETE CASCADE` |
| `changed_fields`   | `jsonb`       | Antes e depois dos campos alterados  |
| `ingestion_run_id` | `uuid`        | FK `ingestion_runs(id)`, nullable    |
| `created_at`       | `timestamptz` |                                      |

### 3.7 `ingestion_runs`

| Coluna                                           | Tipo          | Regras                                       |
| ------------------------------------------------ | ------------- | -------------------------------------------- |
| `id`                                             | `uuid`        | PK                                           |
| `source_id`                                      | `uuid`        | FK `sources(id)`                             |
| `status`                                         | `text`        | `CHECK (status IN ('running','ok','error'))` |
| `started_at` / `finished_at`                     | `timestamptz` |                                              |
| `items_received` / `items_new` / `items_updated` | `integer`     | `CHECK (>= 0)`                               |
| `error_summary`                                  | `text`        | Resumo curto, sem dados sensíveis            |

### 3.8 `scans`

| Coluna              | Tipo          | Regras                                                                   |
| ------------------- | ------------- | ------------------------------------------------------------------------ |
| `id`                | `uuid`        | PK                                                                       |
| `user_id`           | `uuid`        | FK `auth.users(id)` `ON DELETE CASCADE`, `NOT NULL`                      |
| `url`               | `text`        | Como enviada. `CHECK (char_length(url) <= 2048)`                         |
| `normalized_url`    | `text`        | `NOT NULL`                                                               |
| `host`              | `text`        | `NOT NULL`. Usado em índice e em consultas de reputação                  |
| `status`            | `text`        | `CHECK (status IN ('concluido','erro'))`                                 |
| `classification`    | `text`        | `CHECK (classification IN ('confirmado','suspeito','nao_identificado'))` |
| `risk_score`        | `smallint`    | `CHECK (risk_score BETWEEN 0 AND 100)`                                   |
| `risk_level`        | `text`        | `CHECK (risk_level IN ('baixo','moderado','alto','critico'))`            |
| `rules_triggered`   | `jsonb`       | Identificadores e pesos das regras acionadas                             |
| `evidence`          | `jsonb`       | Lista com `evidence_id`, tipo, fonte e data                              |
| `sources_consulted` | `jsonb`       | Fontes consultadas, com resultado e data de cada consulta                |
| `algorithm_version` | `text`        | `NOT NULL`. Versão de `risk-rules.json`                                  |
| `created_at`        | `timestamptz` |                                                                          |

**Dados pessoais:** o `scan` guarda a URL, que pode conter dados do usuário. Não guardar IP, user-agent ou cabeçalhos do usuário. Ver `security.md`, seção LGPD.

### 3.9 `analyses`

| Coluna           | Tipo          | Regras                                                                                           |
| ---------------- | ------------- | ------------------------------------------------------------------------------------------------ |
| `id`             | `uuid`        | PK                                                                                               |
| `scan_id`        | `uuid`        | FK `scans(id)` `ON DELETE CASCADE`, `UNIQUE`                                                     |
| `user_id`        | `uuid`        | FK `auth.users(id)` `ON DELETE CASCADE`. Redundante com `scans.user_id`, mas permite RLS simples |
| `ai_status`      | `text`        | `CHECK (ai_status IN ('ok','fallback','erro'))`                                                  |
| `provider`       | `text`        | Ex.: `anthropic`, `deterministic`                                                                |
| `model`          | `text`        | Ex.: `claude-haiku-5-5`. `NULL` no fallback                                                      |
| `prompt_version` | `text`        | `NOT NULL`                                                                                       |
| `content`        | `jsonb`       | Campos do schema Zod (resumo, recomendações, versões simples e técnica)                          |
| `created_at`     | `timestamptz` |                                                                                                  |

### 3.10 `alerts`

| Coluna              | Tipo          | Regras                                                                   |
| ------------------- | ------------- | ------------------------------------------------------------------------ |
| `id`                | `uuid`        | PK                                                                       |
| `user_id`           | `uuid`        | FK `auth.users(id)` `ON DELETE CASCADE`                                  |
| `threat_id`         | `uuid`        | FK `threats(id)` `ON DELETE CASCADE`                                     |
| `alert_type`        | `text`        | `CHECK (alert_type IN ('nova_ameaca','ameaca_atualizada'))`              |
| `idempotency_key`   | `text`        | `NOT NULL UNIQUE`. Formato `alert:{user_id}:{threat_id}:{alert_type}`    |
| `delivery_status`   | `text`        | `CHECK (delivery_status IN ('pendente','enviado','falhou','cancelado'))` |
| `attempts`          | `smallint`    | `DEFAULT 0`, `CHECK (attempts BETWEEN 0 AND 5)`                          |
| `resend_message_id` | `text`        | Retorno da Resend, nullable                                              |
| `last_error`        | `text`        | Resumo curto                                                             |
| `sent_at`           | `timestamptz` |                                                                          |
| `created_at`        | `timestamptz` |                                                                          |

- `UNIQUE (user_id, threat_id, alert_type)`. Com isso, não existe duas linhas para o mesmo alerta.

### 3.11 `subscriptions`

| Coluna       | Tipo          | Regras                                  |
| ------------ | ------------- | --------------------------------------- |
| `id`         | `uuid`        | PK                                      |
| `user_id`    | `uuid`        | FK `auth.users(id)` `ON DELETE CASCADE` |
| `category`   | `text`        | Mesmos valores de `threats.category`    |
| `enabled`    | `boolean`     | `NOT NULL DEFAULT true`                 |
| `created_at` | `timestamptz` |                                         |

- `UNIQUE (user_id, category)`.

### 3.12 `audit_log`

| Coluna       | Tipo          | Regras                                                               |
| ------------ | ------------- | -------------------------------------------------------------------- |
| `id`         | `bigint`      | PK identity                                                          |
| `actor_id`   | `uuid`        | Nullable (processos automáticos)                                     |
| `action`     | `text`        | Ex.: `auth.login_failed`, `role.changed`, `source.deactivated`       |
| `entity`     | `text`        | Nome da tabela ou recurso                                            |
| `entity_id`  | `text`        |                                                                      |
| `metadata`   | `jsonb`       | **Nunca** contém senha, token, chave ou corpo de requisição completo |
| `created_at` | `timestamptz` |                                                                      |

---

## 4. Índices

| Tabela              | Índice                                                 | Motivo                                      |
| ------------------- | ------------------------------------------------------ | ------------------------------------------- |
| `threats`           | `(category, severity, published_at DESC)`              | Threat Feed com filtros                     |
| `threats`           | `(source_id)`                                          | Chave estrangeira                           |
| `threat_indicators` | `(indicator_id)`                                       | Busca reversa a partir do indicador         |
| `indicators`        | `UNIQUE (indicator_type, indicator_value)`             | Busca no scanner e deduplicação             |
| `indicators`        | `(indicator_value text_pattern_ops)`                   | Busca por prefixo de domínio, se necessário |
| `scans`             | `(user_id, created_at DESC)`                           | Histórico do usuário                        |
| `scans`             | `(host)`                                               | Consulta de reputação                       |
| `alerts`            | `(user_id, created_at DESC)`                           | Lista de alertas                            |
| `alerts`            | `(delivery_status)` `WHERE delivery_status = 'falhou'` | Reenvio de falhas (índice parcial)          |
| `ingestion_runs`    | `(source_id, started_at DESC)`                         | Histórico por fonte                         |
| `subscriptions`     | `(user_id)`                                            | Chave estrangeira                           |

Chaves estrangeiras sem índice são comuns em erros de performance. Conferir com `get_advisors` do Supabase na Fase 2.

---

## 5. Row Level Security

Todas as tabelas no schema `public` têm RLS ativado. Nenhuma tabela fica sem política.

Políticas usam `(select auth.uid())` em vez de `auth.uid()` direto. Isso deixa o Postgres avaliar a função uma vez por consulta.

Funções auxiliares ficam em schema próprio, com `SECURITY DEFINER` e `SET search_path = ''`.

| Tabela                                                | Anônimo | Usuário autenticado                                                             | Admin                          | `service_role` (servidor)  |
| ----------------------------------------------------- | ------- | ------------------------------------------------------------------------------- | ------------------------------ | -------------------------- |
| `profiles`                                            | nada    | `SELECT` e `UPDATE (full_name)` da própria linha                                | `SELECT` de todas              | total (uso administrativo) |
| `sources`                                             | nada    | `SELECT`                                                                        | `SELECT`, `UPDATE (is_active)` | total                      |
| `threats`                                             | nada    | `SELECT`                                                                        | `SELECT`                       | total (ingestão)           |
| `indicators`, `threat_indicators`, `threat_revisions` | nada    | `SELECT`                                                                        | `SELECT`                       | total (ingestão)           |
| `ingestion_runs`                                      | nada    | nada                                                                            | `SELECT`                       | total                      |
| `scans`                                               | nada    | `SELECT`, `INSERT`, `DELETE` da própria linha (`user_id = (select auth.uid())`) | `SELECT` de todas              | total                      |
| `analyses`                                            | nada    | `SELECT`, `INSERT`, `DELETE` da própria linha                                   | `SELECT`                       | total (IA)                 |
| `alerts`                                              | nada    | `SELECT` da própria linha                                                       | `SELECT`                       | total (envio)              |
| `subscriptions`                                       | nada    | `SELECT`, `INSERT`, `UPDATE`, `DELETE` da própria linha                         | `SELECT`                       | total                      |
| `audit_log`                                           | nada    | nada                                                                            | `SELECT`                       | `INSERT`                   |

Pontos de atenção:

- **`WITH CHECK`:** toda política de `INSERT` e `UPDATE` precisa de `WITH CHECK (user_id = (select auth.uid()))`. Sem isso, o usuário pode gravar em nome de outro.
- **Admin sem recursão:** a verificação de admin usa função `SECURITY DEFINER`, não subconsulta em `profiles` dentro da política de `profiles`. Subconsulta direta gera recursão de política.
- **`service_role` ignora RLS.** Ela só existe no servidor, em variável de ambiente. Nunca vai para o frontend. O back-end que atende o usuário usa o JWT do usuário (decisão D5 em `architecture.md`).
- **`DELETE` de scans e análises:** atende ao direito de exclusão do titular de dados (LGPD). Precisa aparecer na tela de histórico.

### Testes de RLS (Fase 2)

Cada política precisa de teste automatizado com dois usuários reais de teste:

1. Usuário A cria um scan. Usuário B não consegue ler, alterar nem apagar.
2. Usuário A tenta gravar `user_id` de B. A gravação é recusada.
3. Usuário A tenta alterar `role` em `profiles`. A alteração é recusada.
4. Usuário anônimo não lê nenhuma tabela de `public`.
5. Usuário autenticado não grava em `threats`, `sources` nem `indicators`.

Os testes rodam no CI (Vitest com cliente Supabase), contra um projeto de teste, nunca contra produção.

---

## 6. Retenção de dados (proposta, a confirmar)

| Dado                    | Retenção sugerida                           | Justificativa                                    |
| ----------------------- | ------------------------------------------- | ------------------------------------------------ |
| `scans` e `analyses`    | 180 dias, ou exclusão imediata pelo usuário | Histórico útil sem acumular URLs indefinidamente |
| `alerts`                | 180 dias                                    | Mesmo critério                                   |
| `ingestion_runs`        | 90 dias                                     | Diagnóstico de fonte                             |
| `threats`, `indicators` | Enquanto a fonte estiver ativa              | Base de inteligência                             |
| `audit_log`             | 365 dias                                    | Auditoria de ações sensíveis                     |
| `profiles`              | Até a exclusão da conta                     | Dados da conta                                   |

Job diário de limpeza, com registro em `audit_log`.

---

## 7. Seeds

- `database/seeds/` contém apenas dados marcados como **DEMO** (ex.: `source.name = 'DEMO — fonte de teste'`).
- Dados de demonstração nunca entram na tabela `threats` de produção. Ambientes de demo usam projeto Supabase separado ou um flag explícito.
- Nenhum dado de demonstração é apresentado como real na interface.

---

## 8. Decisões aplicadas na Fase 2

A proposta de Fase 0 foi implementada nas migrations `database/migrations/0001` a `0004`, com estas diferenças:

1. **Escrita direta bloqueada para dados do servidor.** `scans`, `analyses` e `alerts` não aceitam INSERT nem UPDATE de `anon` ou `authenticated`. Refina a decisão D5 (ver `architecture.md`).
2. **Usuário escreve só o que é preferência dele:** `profiles.full_name` e `subscriptions`. Cada uma com privilégio de coluna.
3. **`is_admin()` no schema `private`**, fora da API REST. O advisor do Supabase apontou a exposição da versão em `public`.
4. **Chave composta em `analyses`:** `(scan_id, user_id)` referencia `scans(id, user_id)`, o que impede um análise apontar para um scan de outro usuário.
5. **`verification_status` e `scans`/`analyses` separados**, como recomendado.

Itens ainda em aberto da seção anterior: prazos de retenção (seção 6) ainda não têm job de limpeza. Ficam para a Fase 9.

### Verificação realizada

- 33 casos de RLS executados no banco `sentinela-dev`, com papéis `anon` e `authenticated` e JWT simulado, dentro de transação com rollback. Todos passaram.
- Advisors de segurança do Supabase: sem alertas abertos após a migration 0004.
- Login real com JWT emitido pelo Supabase: `GET /api/v1/auth/me` retornou 200. Sem token, retornou 401.
- Suíte automatizada `backend/tests/integration/rls.test.ts`: escrita, mas **ainda não executada**. Precisa de `SUPABASE_SERVICE_ROLE_KEY` no `.env` local.

## 9. Decisões a confirmar

1. Confirmar os prazos de retenção da seção 6.
2. Confirmar o nome `verification_status` no lugar de `status` em `threats`.
