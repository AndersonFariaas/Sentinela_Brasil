-- 0004: correções apontadas pelos advisors do Supabase.
-- 1) is_admin() sai do schema public, que a API REST expõe, e vai para private.
--    As políticas de RLS referenciam a função pelo OID, então continuam válidas.
-- 2) Índices nas chaves estrangeiras que não tinham índice de cobertura.

create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.is_admin() set schema private;

revoke execute on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

create index indicators_source_id_idx on public.indicators (source_id);
create index threat_revisions_ingestion_run_id_idx on public.threat_revisions (ingestion_run_id);
