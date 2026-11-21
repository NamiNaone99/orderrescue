begin;

-- Only structured facts are retained. No chat text, customer data or provider output is stored.
create table public.warehouse_reports (
  scenario_id text not null references public.scenarios(id) on delete cascade,
  event_key uuid not null,
  event jsonb not null check (jsonb_typeof(event) = 'object'),
  stock_revision integer not null check (stock_revision > 0),
  primary key (scenario_id, event_key)
);
alter table public.warehouse_reports enable row level security;
revoke all on public.warehouse_reports from public, anon, authenticated;
grant select, insert on public.warehouse_reports to service_role;

-- Old application releases keep reading scenario_snapshots without any shape change.
create view public.scenario_report_snapshots with (security_invoker = true) as
select s.*,
  coalesce((select jsonb_agg(r.event) from public.warehouse_reports r
    where r.scenario_id = s.id and r.event->>'type' = 'resumed'), '[]') as resumptions,
  coalesce((select jsonb_agg(to_jsonb(m)) from (
    select r.event->>'warehouse_id' as warehouse_id, r.event->>'sku_id' as sku_id, max(r.stock_revision) as report_revision
    from public.warehouse_reports r where r.scenario_id = s.id group by 1, 2
  ) m), '[]') as report_revisions
from public.scenario_snapshots s;
revoke all on public.scenario_report_snapshots from public, anon, authenticated;
grant select on public.scenario_report_snapshots to service_role;

create function public.apply_warehouse_report(p_scenario text, p_key uuid, p_event jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  prior jsonb;
  kind text := p_event->>'type';
  original public.stock;
  scenario_day text;
  at_time timestamptz;
  extra integer;
  revision_after integer;
  field text;
begin
  if p_key is null or p_event is null or jsonb_typeof(p_event) <> 'object' then raise exception 'INVALID_INPUT'; end if;
  perform pg_advisory_xact_lock(15, hashtext(p_scenario));
  select event into prior from public.warehouse_reports where scenario_id = p_scenario and event_key = p_key;
  if found then
    if prior <> p_event then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('applied', true, 'replayed', true);
  end if;
  select to_char(now_at at time zone 'Asia/Bangkok', 'YYYY-MM-DD') into scenario_day from public.scenarios where id = p_scenario;
  if not found or kind is null or kind not in ('delay','stock_found','resumed')
    or jsonb_typeof(p_event->'warehouse_id') is distinct from 'string'
    or jsonb_typeof(p_event->'sku_id') is distinct from 'string'
    or (p_event - array['type','warehouse_id','sku_id'] - (case kind
       when 'stock_found' then array['quantity'] when 'resumed' then array['at','window_start','window_end'] else array['at'] end)) <> '{}'::jsonb
  then raise exception 'INVALID_INPUT'; end if;
  select * into original from public.stock where scenario_id = p_scenario and warehouse_id = p_event->>'warehouse_id'
    and sku_id = p_event->>'sku_id' for update;
  if not found then raise exception 'INVALID_INPUT'; end if;
  if kind = 'stock_found' then
    if jsonb_typeof(p_event->'quantity') is distinct from 'number' or (p_event->>'quantity') !~ '^[1-9][0-9]{0,4}$'
      then raise exception 'INVALID_INPUT'; end if;
    extra := (p_event->>'quantity')::int;
    if extra > 10000 or original.on_hand > 2147483647 - extra then raise exception 'INVALID_INPUT'; end if;
  else
    foreach field in array (case kind when 'delay' then array['at'] else array['at','window_start','window_end'] end) loop
      if jsonb_typeof(p_event->field) is distinct from 'string' or
        (p_event->>field) !~ ('^' || scenario_day || 'T([01][0-9]|2[0-3]):[0-5][0-9]:00[+]07:00$')
      then raise exception 'INVALID_INPUT'; end if;
    end loop;
    at_time := (p_event->>'at')::timestamptz;
    if kind = 'delay' and at_time <= original.ready_at then raise exception 'INVALID_INPUT'; end if;
    if kind = 'resumed' and not (p_event->>'window_start' < p_event->>'window_end'
      and p_event->>'at' >= p_event->>'window_start' and p_event->>'at' < p_event->>'window_end')
      then raise exception 'INVALID_INPUT'; end if;
  end if;
  update public.stock set ready_at = case when kind = 'delay' then at_time else ready_at end,
    on_hand = on_hand + coalesce(extra,0), revision = revision + 1
    where scenario_id = p_scenario and warehouse_id = original.warehouse_id and sku_id = original.sku_id
    returning revision into revision_after;
  if kind = 'delay' then
    -- The existing simulator must not move readiness backward after a newer confirmed report.
    update public.scenarios s set demo_events = (
      select jsonb_agg(case when s.event_changes->(e.item->>'id')->>'warehouse_id' = original.warehouse_id
        and s.event_changes->(e.item->>'id')->>'sku_id' = original.sku_id
        and (s.event_changes->(e.item->>'id')->>'ready_at')::timestamptz <= at_time
        then e.item || '{"applied":true}'::jsonb else e.item end order by e.pos)
      from jsonb_array_elements(s.demo_events) with ordinality as e(item,pos)
    ) where s.id = p_scenario and jsonb_array_length(s.demo_events) > 0;
  end if;
  insert into public.warehouse_reports values (p_scenario, p_key, p_event, revision_after);
  return jsonb_build_object('applied', true, 'replayed', false);
end $$;
revoke all on function public.apply_warehouse_report(text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.apply_warehouse_report(text,uuid,jsonb) to service_role;

commit;
