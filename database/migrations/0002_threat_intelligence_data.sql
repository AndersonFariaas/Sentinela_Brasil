-- 0002: dados globais de inteligência de ameaças.
-- Escritos só pelo servidor (service_role). Usuários autenticados apenas leem.

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 120),
  source_type text not null check (source_type in ('api', 'feed_json', 'feed_rss', 'html')),
  base_url text not null check (base_url like 'https://%'),
  description text,
  reliability smallint not null check (reliability between 1 and 5),
  terms_url text,
  is_active boolean not null default true,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error_summary text check (char_length(last_error_summary) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sources_set_updated_at
  before update on public.sources
  for each row execute function public.set_updated_at();

create table public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id) on delete restrict,
  status text not null check (status in ('running', 'ok', 'error')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  items_received integer not null default 0 check (items_received >= 0),
  items_new integer not null default 0 check (items_new >= 0),
  items_updated integer not null default 0 check (items_updated >= 0),
  error_summary text check (char_length(error_summary) <= 500),
  check (finished_at is null or finished_at >= started_at)
);

create index ingestion_runs_source_started_idx
  on public.ingestion_runs (source_id, started_at desc);

create table public.threats (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  external_id text,
  title text not null check (char_length(title) between 1 and 300),
  description text,
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
  severity text not null check (severity in ('baixo', 'moderado', 'alto', 'critico')),
  verification_status text not null default 'nao_verificada'
    check (verification_status in ('nao_verificada', 'verificada', 'descartada')),
  cve_id text check (cve_id is null or cve_id ~ '^CVE-[0-9]{4}-[0-9]{4,}$'),
  source_id uuid not null references public.sources (id) on delete restrict,
  source_url text check (source_url is null or source_url like 'https://%'),
  published_at timestamptz,
  collected_at timestamptz not null default now(),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger threats_set_updated_at
  before update on public.threats
  for each row execute function public.set_updated_at();

create index threats_category_severity_published_idx
  on public.threats (category, severity, published_at desc);

create index threats_source_id_idx on public.threats (source_id);

-- Indicadores são únicos globalmente e ligados às ameaças pela tabela de junção.
create table public.indicators (
  id uuid primary key default gen_random_uuid(),
  indicator_type text not null check (indicator_type in ('domain', 'url', 'ip', 'sha256', 'cve')),
  indicator_value text not null check (char_length(indicator_value) between 1 and 2048),
  confidence smallint not null default 50 check (confidence between 0 and 100),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  source_id uuid not null references public.sources (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (indicator_type, indicator_value),
  check (last_seen_at >= first_seen_at)
);

create table public.threat_indicators (
  threat_id uuid not null references public.threats (id) on delete cascade,
  indicator_id uuid not null references public.indicators (id) on delete cascade,
  primary key (threat_id, indicator_id)
);

create index threat_indicators_indicator_id_idx on public.threat_indicators (indicator_id);

create table public.threat_revisions (
  id bigint generated always as identity primary key,
  threat_id uuid not null references public.threats (id) on delete cascade,
  changed_fields jsonb not null check (jsonb_typeof(changed_fields) = 'object'),
  ingestion_run_id uuid references public.ingestion_runs (id) on delete set null,
  created_at timestamptz not null default now()
);

create index threat_revisions_threat_created_idx
  on public.threat_revisions (threat_id, created_at desc);

-- RLS e privilégios: leitura para autenticados, escrita restrita ao servidor.
alter table public.sources enable row level security;
alter table public.ingestion_runs enable row level security;
alter table public.threats enable row level security;
alter table public.indicators enable row level security;
alter table public.threat_indicators enable row level security;
alter table public.threat_revisions enable row level security;

revoke all on public.sources, public.ingestion_runs, public.threats,
  public.indicators, public.threat_indicators, public.threat_revisions
  from anon, authenticated;

grant select on public.sources, public.threats, public.indicators,
  public.threat_indicators, public.threat_revisions to authenticated;
-- Só administradores ativam ou desativam fontes, e só essa coluna.
grant update (is_active) on public.sources to authenticated;
grant select on public.ingestion_runs to authenticated;

create policy sources_select_all
  on public.sources for select to authenticated using (true);

create policy sources_update_admin
  on public.sources for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy threats_select_all
  on public.threats for select to authenticated using (true);

create policy indicators_select_all
  on public.indicators for select to authenticated using (true);

create policy threat_indicators_select_all
  on public.threat_indicators for select to authenticated using (true);

create policy threat_revisions_select_all
  on public.threat_revisions for select to authenticated using (true);

create policy ingestion_runs_select_admin
  on public.ingestion_runs for select to authenticated
  using ((select public.is_admin()));
