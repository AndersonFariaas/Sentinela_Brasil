-- 0003: dados por usuário, inscrições e auditoria.
-- scans, analyses e alerts são criados pelo servidor (service_role).
-- O usuário lê o próprio histórico e pode apagá-lo (direito de exclusão, LGPD).

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  url text not null check (char_length(url) between 1 and 2048),
  normalized_url text not null check (char_length(normalized_url) between 1 and 2048),
  host text not null check (char_length(host) between 1 and 253),
  status text not null check (status in ('concluido', 'erro')),
  classification text not null
    check (classification in ('confirmado', 'suspeito', 'nao_identificado')),
  risk_score smallint not null check (risk_score between 0 and 100),
  risk_level text not null check (risk_level in ('baixo', 'moderado', 'alto', 'critico')),
  rules_triggered jsonb not null default '[]'::jsonb
    check (jsonb_typeof(rules_triggered) = 'array'),
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  sources_consulted jsonb not null default '[]'::jsonb
    check (jsonb_typeof(sources_consulted) = 'array'),
  algorithm_version text not null check (char_length(algorithm_version) between 1 and 40),
  created_at timestamptz not null default now(),
  -- Permite que analyses referencie o par (scan, dono) e impeça divergência de dono.
  unique (id, user_id)
);

create index scans_user_created_idx on public.scans (user_id, created_at desc);
create index scans_host_idx on public.scans (host);

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  ai_status text not null check (ai_status in ('ok', 'fallback', 'erro')),
  provider text not null check (char_length(provider) between 1 and 40),
  model text check (model is null or char_length(model) <= 80),
  prompt_version text not null check (char_length(prompt_version) between 1 and 40),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (scan_id, user_id) references public.scans (id, user_id) on delete cascade
);

create index analyses_user_id_idx on public.analyses (user_id);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  threat_id uuid not null references public.threats (id) on delete cascade,
  alert_type text not null check (alert_type in ('nova_ameaca', 'ameaca_atualizada')),
  idempotency_key text not null unique,
  delivery_status text not null default 'pendente'
    check (delivery_status in ('pendente', 'enviado', 'falhou', 'cancelado')),
  attempts smallint not null default 0 check (attempts between 0 and 5),
  resend_message_id text,
  last_error text check (char_length(last_error) <= 500),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, threat_id, alert_type),
  check (
    idempotency_key = 'alert:' || user_id::text || ':' || threat_id::text || ':' || alert_type
  )
);

create index alerts_user_created_idx on public.alerts (user_id, created_at desc);
create index alerts_threat_id_idx on public.alerts (threat_id);
create index alerts_failed_idx on public.alerts (delivery_status)
  where delivery_status = 'falhou';

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (
    category in (
      'phishing',
      'malware',
      'ransomware',
      'malicious_domain',
      'suspicious_url',
      'digital_fraud',
      'exploited_vulnerability'
    )
  ),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, category)
);

-- Auditoria. Sem FK em actor_id de propósito: o registro deve sobreviver à exclusão da conta.
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null check (char_length(action) between 1 and 100),
  entity text not null check (char_length(entity) between 1 and 60),
  entity_id text check (char_length(entity_id) <= 100),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index audit_log_created_at_idx on public.audit_log (created_at desc);

-- RLS e privilégios.
alter table public.scans enable row level security;
alter table public.analyses enable row level security;
alter table public.alerts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.audit_log enable row level security;

revoke all on public.scans, public.analyses, public.alerts,
  public.subscriptions, public.audit_log
  from anon, authenticated;

-- Histórico: leitura e exclusão pelo dono. Nenhuma escrita direta.
grant select, delete on public.scans to authenticated;
grant select, delete on public.analyses to authenticated;
grant select on public.alerts to authenticated;

-- Inscrições são preferência do usuário, então ele as cria e altera.
grant select, delete on public.subscriptions to authenticated;
grant insert (user_id, category, enabled) on public.subscriptions to authenticated;
grant update (enabled) on public.subscriptions to authenticated;

grant select on public.audit_log to authenticated;

create policy scans_select_own_or_admin
  on public.scans for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));

create policy scans_delete_own
  on public.scans for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy analyses_select_own_or_admin
  on public.analyses for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));

create policy analyses_delete_own
  on public.analyses for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy alerts_select_own_or_admin
  on public.alerts for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));

create policy subscriptions_select_own_or_admin
  on public.subscriptions for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));

create policy subscriptions_insert_own
  on public.subscriptions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy subscriptions_update_own
  on public.subscriptions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy subscriptions_delete_own
  on public.subscriptions for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy audit_log_select_admin
  on public.audit_log for select to authenticated
  using ((select public.is_admin()));
