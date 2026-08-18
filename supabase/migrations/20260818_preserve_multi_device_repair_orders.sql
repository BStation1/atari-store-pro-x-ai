-- Persist the complete device list for multi-device repair orders.
alter table public.repair_orders
  add column if not exists devices jsonb not null default '[]'::jsonb;

update public.repair_orders
set devices = coalesce(
  case
    when notes is not null and btrim(notes) <> '' and left(btrim(notes), 1) = '{'
      then coalesce((notes::jsonb)->'devices', '[]'::jsonb)
    else '[]'::jsonb
  end,
  '[]'::jsonb
)
where devices = '[]'::jsonb;

create or replace function public.preserve_repair_order_devices()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  incoming jsonb := '[]'::jsonb;
  note_json jsonb;
begin
  if new.notes is not null and btrim(new.notes) <> '' and left(btrim(new.notes), 1) = '{' then
    begin
      note_json := new.notes::jsonb;
      if jsonb_typeof(note_json->'devices') = 'array' then
        incoming := note_json->'devices';
      end if;
    exception when others then
      note_json := null;
      incoming := '[]'::jsonb;
    end;
  end if;

  if tg_op = 'INSERT' then
    if jsonb_array_length(incoming) > 0 then
      new.devices := incoming;
    elsif new.devices is null then
      new.devices := '[]'::jsonb;
    end if;
    return new;
  end if;

  if jsonb_array_length(incoming) >= jsonb_array_length(coalesce(old.devices, '[]'::jsonb)) then
    if jsonb_array_length(incoming) > 0 then
      new.devices := incoming;
    else
      new.devices := coalesce(old.devices, '[]'::jsonb);
    end if;
  else
    new.devices := coalesce(old.devices, '[]'::jsonb);
    if note_json is not null then
      note_json := jsonb_set(note_json, '{devices}', new.devices, true);
      new.notes := note_json::text;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_preserve_repair_order_devices on public.repair_orders;
create trigger trg_preserve_repair_order_devices
before insert or update on public.repair_orders
for each row execute function public.preserve_repair_order_devices();

update public.repair_orders
set notes = notes
where notes is not null;
