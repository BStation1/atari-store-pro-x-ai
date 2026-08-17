create or replace function public.bootstrap_first_owner()
returns public.profiles
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if exists (
    select 1 from public.profiles
    where role::text in ('OWNER','ADMIN') and is_active=true
  ) then
    raise exception 'Owner already exists';
  end if;

  update public.profiles
     set role='OWNER'::public.user_role_enum,
         is_active=true,
         updated_at=now()
   where id=v_uid
   returning * into v_profile;

  if v_profile.id is null then
    raise exception 'Profile not found';
  end if;

  return v_profile;
end;
$$;
revoke all on function public.bootstrap_first_owner() from public, anon;
grant execute on function public.bootstrap_first_owner() to authenticated;
