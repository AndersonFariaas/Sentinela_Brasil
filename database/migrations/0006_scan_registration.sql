-- 0006: registro de escaneamentos pelo usuário autenticado.
-- scans e analyses não aceitam escrita direta (0003). A função abaixo grava as duas
-- linhas na mesma transação e usa auth.uid() como dono. Assim a service_role
-- não precisa ficar no servidor que atende o usuário.

create or replace function public.registrar_escaneamento(
  p_url text,
  p_normalized_url text,
  p_host text,
  p_classification text,
  p_risk_score smallint,
  p_risk_level text,
  p_rules_triggered jsonb,
  p_evidence jsonb,
  p_sources_consulted jsonb,
  p_algorithm_version text,
  p_ai_status text,
  p_provider text,
  p_model text,
  p_prompt_version text,
  p_analysis_content jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_scan_id uuid;
begin
  if v_usuario is null then
    raise exception 'autenticação necessária' using errcode = '42501';
  end if;

  insert into public.scans (
    user_id, url, normalized_url, host, status, classification, risk_score, risk_level,
    rules_triggered, evidence, sources_consulted, algorithm_version
  )
  values (
    v_usuario, p_url, p_normalized_url, p_host, 'concluido', p_classification, p_risk_score,
    p_risk_level, p_rules_triggered, p_evidence, p_sources_consulted, p_algorithm_version
  )
  returning id into v_scan_id;

  insert into public.analyses (
    scan_id, user_id, ai_status, provider, model, prompt_version, content
  )
  values (
    v_scan_id, v_usuario, p_ai_status, p_provider, p_model, p_prompt_version, p_analysis_content
  );

  return v_scan_id;
end;
$$;

revoke all on function public.registrar_escaneamento(
  text, text, text, text, smallint, text, jsonb, jsonb, jsonb, text, text, text, text, text, jsonb
) from public, anon;

grant execute on function public.registrar_escaneamento(
  text, text, text, text, smallint, text, jsonb, jsonb, jsonb, text, text, text, text, text, jsonb
) to authenticated;
