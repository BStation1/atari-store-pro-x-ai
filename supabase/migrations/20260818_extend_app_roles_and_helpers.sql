alter type public.user_role_enum add value if not exists 'ADMIN';
alter type public.user_role_enum add value if not exists 'MANAGER';
alter type public.user_role_enum add value if not exists 'INVENTORY';
alter type public.user_role_enum add value if not exists 'ACCOUNTANT';
alter type public.user_role_enum add value if not exists 'VIEWER';

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path=public
as $$
  select p.role::text
  from public.profiles p
  where p.id=auth.uid() and p.is_active=true
  limit 1
$$;
revoke all on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated;

create or replace function public.has_app_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(public.current_app_role() = any(allowed_roles), false)
$$;
revoke all on function public.has_app_role(text[]) from public, anon;
grant execute on function public.has_app_role(text[]) to authenticated;
