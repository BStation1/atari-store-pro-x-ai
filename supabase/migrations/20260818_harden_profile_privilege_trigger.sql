-- Prevent authenticated clients from creating or mutating privileged profile fields.
-- The first OWNER bootstrap remains allowed only when no OWNER/ADMIN exists yet.

create or replace function public.enforce_profile_privilege_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  privileged_exists boolean;
begin
  -- Trusted backend/service operations are not tied to a user JWT.
  if actor_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A client may only create its own profile row.
    if new.id is distinct from actor_id then
      raise exception 'profile id must match authenticated user';
    end if;

    select exists (
      select 1
      from public.profiles p
      where upper(coalesce(p.role::text, '')) in ('OWNER', 'ADMIN')
        and coalesce(p.is_active, true) = true
    ) into privileged_exists;

    -- Bootstrap OWNER is allowed exactly while the system has no privileged account.
    if upper(coalesce(new.role::text, '')) = 'OWNER' and not privileged_exists then
      new.custom_permissions := coalesce(new.custom_permissions, '[]'::jsonb);
      new.is_active := true;
      return new;
    end if;

    -- Self-created profiles can never choose elevated privileges.
    new.role := 'RECEPTION'::public.user_role;
    new.custom_permissions := '[]'::jsonb;
    new.is_active := true;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Profile primary keys are identity bindings and must never be migrated client-side.
    if new.id is distinct from old.id then
      raise exception 'profile id is immutable';
    end if;

    select upper(coalesce(p.role::text, ''))
      into actor_role
      from public.profiles p
     where p.id = actor_id
     limit 1;

    if actor_role not in ('OWNER', 'ADMIN') then
      if new.role is distinct from old.role
         or new.custom_permissions is distinct from old.custom_permissions
         or new.is_active is distinct from old.is_active then
        raise exception 'insufficient privileges to modify profile authorization fields';
      end if;
    end if;

    return new;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_profile_privilege_integrity() from public;

-- Replace any prior trigger with the hardened version.
drop trigger if exists trg_enforce_profile_privilege_integrity on public.profiles;
create trigger trg_enforce_profile_privilege_integrity
before insert or update on public.profiles
for each row
execute function public.enforce_profile_privilege_integrity();
