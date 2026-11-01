-- 0001: perfis, papéis e função de administrador.
-- Cada usuário do Supabase Auth tem exatamente uma linha em public.profiles.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) between 2 and 120),
  email text not null,
  role text not null default 'user' check (role in ('user', 'analyst', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cria o perfil no cadastro. Roda como dono da função para ignorar RLS de profiles.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mantém o e-mail do perfil igual ao do Auth quando o usuário troca de e-mail.
create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email = new.email
  where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- Funções de trigger não devem ser chamadas pela API REST.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;

-- Verificação de administrador usada pelas políticas de RLS.
-- SECURITY DEFINER evita recursão de RLS ao consultar profiles.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- RLS e privilégios de coluna.
-- O usuário altera só o próprio nome. O papel (role) nunca é alterável por ele.
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select, update (full_name) on public.profiles to authenticated;

create policy profiles_select_own_or_admin
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id or (select public.is_admin()));

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
