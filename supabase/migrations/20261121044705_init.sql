begin;

grant usage on schema public to service_role;

create table public.scenarios (
  id text primary key,
  name_th text not null,
  name_en text not null,
  kind text not null check (kind in ('synthetic', 'real_derived')),
  now_at timestamptz not null,
  default_budget_thb integer not null check (default_budget_thb >= 0),
  shifts jsonb not null,
  demo_events jsonb not null,
  default_sku_id text not null,
  sample_messages jsonb not null,
  event_changes jsonb not null default '{}'
);
create table public.warehouses (
  scenario_id text not null references public.scenarios on delete cascade,
  id text not null, name_th text not null, is_home boolean not null,
  primary key (scenario_id, id)
);
create table public.skus (
  scenario_id text not null references public.scenarios on delete cascade,
  id text not null, name text not null,
  primary key (scenario_id, id)
);
create table public.stock (
  scenario_id text not null references public.scenarios on delete cascade,
  warehouse_id text not null, sku_id text not null,
  on_hand integer not null check (on_hand >= 0),
  committed integer not null check (committed between 0 and on_hand),
  ready_at timestamptz not null,
  extra_cost_per_unit_thb integer not null check (extra_cost_per_unit_thb >= 0),
  revision integer not null default 1 check (revision >= 0),
  primary key (scenario_id, warehouse_id, sku_id),
  foreign key (scenario_id, warehouse_id) references public.warehouses,
  foreign key (scenario_id, sku_id) references public.skus
);
create table public.orders (
  scenario_id text not null references public.scenarios on delete cascade,
  id text not null, received_at timestamptz not null, deadline_at timestamptz not null,
  home_warehouse_id text not null, customer_ref text,
  status text not null check (status in ('open', 'reserved', 'needs_human')),
  primary key (scenario_id, id),
  foreign key (scenario_id, home_warehouse_id) references public.warehouses
);
create table public.order_lines (
  scenario_id text not null references public.scenarios on delete cascade,
  order_id text not null, sku_id text not null, qty integer not null check (qty > 0),
  primary key (scenario_id, order_id, sku_id),
  foreign key (scenario_id, order_id) references public.orders,
  foreign key (scenario_id, sku_id) references public.skus
);
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  scenario_id text not null references public.scenarios on delete cascade,
  idempotency_key text not null unique, plan_hash text not null,
  budget_thb integer not null check (budget_thb >= 0),
  total_extra_cost_thb integer not null check (total_extra_cost_thb between 0 and budget_thb),
  lines jsonb not null, created_at timestamptz not null default now(),
  unique (scenario_id, id)
);
create table public.reservation_lines (
  reservation_id uuid not null, scenario_id text not null, order_id text not null,
  sku_id text not null, warehouse_id text not null,
  qty integer not null check (qty > 0), unit_cost_thb integer not null check (unit_cost_thb >= 0),
  primary key (scenario_id, order_id, sku_id),
  foreign key (scenario_id, reservation_id) references public.reservations(scenario_id, id) on delete cascade,
  foreign key (scenario_id, order_id, sku_id) references public.order_lines,
  foreign key (scenario_id, warehouse_id, sku_id) references public.stock
);

-- Seed copies contain the initial state. Reservations are always empty at reset.
do $privileges$
declare
  tab text;
begin
  foreach tab in array array['scenarios','warehouses','skus','stock','orders','order_lines'] loop
    execute format('create table public.%I (like public.%I including all)', 'seed_' || tab, tab);
  end loop;
  foreach tab in array array['scenarios','warehouses','skus','stock','orders','order_lines',
    'reservations','reservation_lines','seed_scenarios','seed_warehouses','seed_skus',
    'seed_stock','seed_orders','seed_order_lines'] loop
    execute format('alter table public.%I enable row level security', tab);
    execute format('revoke all on table public.%I from public, anon, authenticated', tab);
    execute format('grant select, insert, update, delete on table public.%I to service_role', tab);
  end loop;
end $privileges$;

-- Aggregate inside a single MVCC snapshot, including scenarios beyond PostgREST's row cap.
create view public.scenario_snapshots with (security_invoker = true) as
select s.id, to_jsonb(s) - 'event_changes' as scenario,
  coalesce((select jsonb_agg(to_jsonb(w) - 'scenario_id' order by w.id) from public.warehouses w where w.scenario_id = s.id), '[]') as warehouses,
  coalesce((select jsonb_agg(to_jsonb(k) - 'scenario_id' order by k.id) from public.skus k where k.scenario_id = s.id), '[]') as skus,
  coalesce((select jsonb_agg(to_jsonb(t) - 'scenario_id' order by t.warehouse_id, t.sku_id) from public.stock t where t.scenario_id = s.id), '[]') as stock,
  coalesce((select jsonb_agg(to_jsonb(o) - 'scenario_id' order by o.id) from public.orders o where o.scenario_id = s.id), '[]') as orders,
  coalesce((select jsonb_agg(to_jsonb(l) - 'scenario_id' order by l.order_id, l.sku_id) from public.order_lines l where l.scenario_id = s.id), '[]') as order_lines,
  coalesce((select jsonb_agg(to_jsonb(r) - 'scenario_id' order by r.created_at, r.id) from public.reservations r where r.scenario_id = s.id), '[]') as reservations
from public.scenarios s;
revoke all on public.scenario_snapshots from public, anon, authenticated;
grant select on public.scenario_snapshots to service_role;

create function public.reset_demo(p_scenario text default null) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  sid text;
  tab text;
begin
  if p_scenario is not null and not exists (select 1 from public.seed_scenarios where id = p_scenario) then
    raise exception 'INVALID_INPUT';
  end if;
  for sid in select id from public.seed_scenarios where p_scenario is null or id = p_scenario order by id loop
    -- An exclusive scenario lock waits for in-flight events and bookings to finish.
    perform pg_advisory_xact_lock(15, hashtext(sid));
    delete from public.reservations where scenario_id = sid;
    delete from public.scenarios where id = sid;
    insert into public.scenarios select * from public.seed_scenarios where id = sid;
    foreach tab in array array['warehouses','skus','stock','orders','order_lines'] loop
      execute format('insert into public.%I select * from public.%I where scenario_id = $1', tab, 'seed_' || tab) using sid;
    end loop;
  end loop;
end $$;

create function public.reserve_plan(p_scenario text, p_key text, p_plan_hash text, p_budget integer, p_lines jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  saved public.reservations;
  stock_row public.stock;
  current_order public.orders;
  line record;
  grp record;
  total numeric;
  incident_header text;
  incident jsonb;
  replayed boolean := false;
begin
  p_key := lower(p_key);
  perform pg_advisory_xact_lock(hashtext(p_key));
  perform pg_advisory_xact_lock_shared(15, hashtext(p_scenario));
  select * into saved from public.reservations where idempotency_key = p_key;
  if found then
    if saved.plan_hash is distinct from p_plan_hash or saved.scenario_id is distinct from p_scenario then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    replayed := true;
  else
    if p_key is null or p_key <> (p_key::uuid)::text or p_plan_hash is null or p_plan_hash !~ '^[0-9a-f]{64}$'
      or p_budget is null or p_budget < 0 or jsonb_typeof(p_lines) is distinct from 'array' then
      raise exception 'INVALID_INPUT';
    end if;
    if jsonb_array_length(p_lines) = 0 or exists (
      select 1 from jsonb_array_elements(p_lines) l(item) where jsonb_typeof(item) <> 'object'
        or item - array['order_id','sku_id','warehouse_id','qty','unit_cost_thb','expected_revision'] <> '{}'::jsonb
        or jsonb_typeof(item->'order_id') is distinct from 'string' or jsonb_typeof(item->'sku_id') is distinct from 'string'
        or jsonb_typeof(item->'warehouse_id') is distinct from 'string' or jsonb_typeof(item->'qty') is distinct from 'number'
        or jsonb_typeof(item->'unit_cost_thb') is distinct from 'number' or jsonb_typeof(item->'expected_revision') is distinct from 'number'
    ) or exists (
      select 1 from jsonb_to_recordset(p_lines) l(order_id text, sku_id text, warehouse_id text, qty int, unit_cost_thb int, expected_revision int)
      where l.order_id is null or l.sku_id is null or l.warehouse_id is null or l.qty is null or l.qty <= 0
        or l.unit_cost_thb is null or l.unit_cost_thb < 0 or l.expected_revision is null or l.expected_revision < 0
    ) then raise exception 'INVALID_INPUT'; end if;
    select sum(qty::numeric * unit_cost_thb) into total from jsonb_to_recordset(p_lines) l(qty int, unit_cost_thb int);
    if total > p_budget then raise exception 'OVER_BUDGET'; end if;
    incident_header := nullif(current_setting('request.headers',true),'')::jsonb->>'x-orderrescue-incident';
    if incident_header is not null then
      incident := convert_from(decode(incident_header,'base64'),'UTF8')::jsonb;
      if not exists (select 1 from public.warehouses where scenario_id = p_scenario and id = incident->>0)
        or not exists (select 1 from public.skus where scenario_id = p_scenario and id = incident->>1) then
        raise exception 'INVALID_INPUT';
      end if;
    end if;

    -- Lock orders in canonical order before touching stock, including bookings with different keys.
    for line in select * from jsonb_to_recordset(p_lines) l(order_id text, sku_id text, qty int) order by order_id, sku_id loop
      select * into current_order from public.orders where scenario_id = p_scenario and id = line.order_id for update;
      if current_order.status = 'reserved' then raise exception 'ORDER_ALREADY_RESERVED'; end if;
      if current_order.status is distinct from 'open' or not exists (
        select 1 from public.order_lines where scenario_id = p_scenario and order_id = line.order_id and sku_id = line.sku_id and qty = line.qty
      ) then raise exception 'INVALID_INPUT'; end if;
    end loop;

    for grp in
      select l.warehouse_id, l.sku_id, sum(l.qty) as qty, min(l.expected_revision) as rev, max(l.expected_revision) as max_rev,
        bool_or(l.warehouse_id = o.home_warehouse_id and l.unit_cost_thb <> 0) as bad_home_cost,
        min(l.unit_cost_thb) filter (where l.warehouse_id <> o.home_warehouse_id) as min_cost,
        max(l.unit_cost_thb) filter (where l.warehouse_id <> o.home_warehouse_id) as max_cost
      from jsonb_to_recordset(p_lines) l(order_id text, warehouse_id text, sku_id text, qty int, expected_revision int, unit_cost_thb int)
      join public.orders o on o.scenario_id = p_scenario and o.id = l.order_id
      group by l.warehouse_id, l.sku_id order by l.warehouse_id, l.sku_id
    loop
      if grp.rev <> grp.max_rev then raise exception 'INVALID_INPUT'; end if;
      select * into stock_row from public.stock where scenario_id = p_scenario
        and warehouse_id = grp.warehouse_id and sku_id = grp.sku_id for update;
      if not found or stock_row.revision <> grp.rev or stock_row.on_hand - stock_row.committed < grp.qty
        or grp.bad_home_cost or grp.min_cost <> stock_row.extra_cost_per_unit_thb or grp.max_cost <> stock_row.extra_cost_per_unit_thb then
        raise exception 'STALE_STOCK';
      end if;
      update public.stock set committed = committed + grp.qty, revision = revision + 1
        where scenario_id = p_scenario and warehouse_id = grp.warehouse_id and sku_id = grp.sku_id;
    end loop;
    insert into public.reservations (scenario_id,idempotency_key,plan_hash,budget_thb,total_extra_cost_thb,lines)
      values (p_scenario,p_key,p_plan_hash,p_budget,total,p_lines) returning * into saved;
    begin
      insert into public.reservation_lines (reservation_id,scenario_id,order_id,sku_id,warehouse_id,qty,unit_cost_thb)
        select saved.id,p_scenario,l.order_id,l.sku_id,l.warehouse_id,l.qty,l.unit_cost_thb
        from jsonb_to_recordset(p_lines) l(order_id text, sku_id text, warehouse_id text, qty int, unit_cost_thb int);
    exception when unique_violation then raise exception 'ORDER_ALREADY_RESERVED';
    end;
    update public.orders set status = 'reserved' where scenario_id = p_scenario
      and id in (select order_id from jsonb_to_recordset(p_lines) l(order_id text));
  end if;
  return jsonb_build_object('receipt', to_jsonb(saved) - 'scenario_id' - 'budget_thb', 'replayed', replayed);
exception when invalid_text_representation or numeric_value_out_of_range or invalid_parameter_value then
  raise exception 'INVALID_INPUT';
end $$;

create function public.apply_demo_event(p_scenario text, p_event_id text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  sc public.scenarios;
  change jsonb;
  event_index integer;
begin
  perform pg_advisory_xact_lock_shared(15, hashtext(p_scenario));
  select * into sc from public.scenarios where id = p_scenario for no key update;
  select (n - 1)::int into event_index from jsonb_array_elements(sc.demo_events) with ordinality e(item,n)
    where item->>'id' = p_event_id;
  change := sc.event_changes->p_event_id;
  if event_index is null or change is null then raise exception 'INVALID_INPUT'; end if;
  if not (sc.demo_events->event_index->>'applied')::boolean then
    update public.stock set ready_at = (change->>'ready_at')::timestamptz, revision = revision + (change->>'revision_increment')::int
      where scenario_id = p_scenario and warehouse_id = change->>'warehouse_id' and sku_id = change->>'sku_id';
    if not found then raise exception 'STALE_STOCK'; end if;
    update public.scenarios set demo_events = jsonb_set(demo_events, array[event_index::text, 'applied'], 'true') where id = p_scenario;
  end if;
  -- Return the exact version inputs observed by this transaction; both adapters use the same hash.
  return jsonb_build_object('applied',true,
    'stock',coalesce((select jsonb_agg(jsonb_build_object('warehouse_id',warehouse_id,'sku_id',sku_id,'revision',revision)) from public.stock where scenario_id = p_scenario),'[]'::jsonb),
    'orders',coalesce((select jsonb_agg(jsonb_build_object('id',id,'status',status)) from public.orders where scenario_id = p_scenario),'[]'::jsonb));
end $$;

revoke all on function public.reserve_plan(text,text,text,integer,jsonb), public.apply_demo_event(text,text), public.reset_demo(text) from public, anon, authenticated;
grant execute on function public.reserve_plan(text,text,text,integer,jsonb), public.apply_demo_event(text,text), public.reset_demo(text) to service_role;
commit;
