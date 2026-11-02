-- Cancelamento de inscrição em alertas (Fase 7, FE-011).
-- O link do e-mail leva o id da inscrição. A função desativa só essa linha e não
-- revela se o id existe: a resposta é a mesma nos dois casos.
-- Sem service_role na API: a função roda como dona da tabela, com escopo mínimo.

create or replace function public.cancelar_inscricao(p_inscricao_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.subscriptions
  set enabled = false
  where id = p_inscricao_id
    and enabled = true;
$$;

revoke all on function public.cancelar_inscricao(uuid) from public;
grant execute on function public.cancelar_inscricao(uuid) to anon, authenticated;
