-- =============================================
-- Gestão Hub - Admin panel foundation (v1)
-- =============================================
-- Execute após schema_app_v1.sql.

create extension if not exists pgcrypto;

-- ---------------------------------------------
-- Helpers
-- ---------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin', -- admin | supervisor | auditor
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_admin_users_updated_at on public.admin_users;
create trigger trg_admin_users_updated_at
before update on public.admin_users
for each row execute function public.set_updated_at();

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------
-- Presença / sessão do app
-- ---------------------------------------------
create table if not exists public.user_presence (
  session_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_label text,
  platform text,
  app_version text,
  current_module text,
  current_screen text,
  current_order_ref text,
  current_batch_ref text,
  status text not null default 'online', -- online | idle | offline | signed_out
  signed_in_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  signed_out_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_presence_user on public.user_presence(user_id);
create index if not exists idx_user_presence_status on public.user_presence(status);
create index if not exists idx_user_presence_heartbeat on public.user_presence(last_heartbeat_at desc);

drop trigger if exists trg_user_presence_updated_at on public.user_presence;
create trigger trg_user_presence_updated_at
before update on public.user_presence
for each row execute function public.set_updated_at();

-- ---------------------------------------------
-- Auditoria operacional
-- ---------------------------------------------
create table if not exists public.operational_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  session_id uuid references public.user_presence(session_id) on delete set null,
  module text not null,
  event_type text not null,
  entity_type text,
  entity_id text,
  order_ref text,
  batch_ref text,
  actor_name text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_operational_events_user on public.operational_events(user_id);
create index if not exists idx_operational_events_module on public.operational_events(module);
create index if not exists idx_operational_events_entity on public.operational_events(entity_type, entity_id);
create index if not exists idx_operational_events_created_at on public.operational_events(created_at desc);

-- ---------------------------------------------
-- Fila de bonus / importacao XML de NF
-- ---------------------------------------------
create table if not exists public.conferencia_bonus_queue (
  id uuid primary key default gen_random_uuid(),
  source_type text not null default 'xml_nf', -- xml_nf | manual
  invoice_key text,
  invoice_number text not null,
  supplier_name text not null,
  supplier_code text,
  supplier_document text,
  issued_at timestamptz,
  item_count integer not null default 0,
  total_quantity numeric(14,3) not null default 0,
  status text not null default 'nao_iniciado', -- nao_iniciado | em_conferencia | finalizada | cancelada
  imported_by uuid references auth.users(id) on delete set null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  assigned_user_name text,
  imported_payload jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conferencia_bonus_queue_items (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.conferencia_bonus_queue(id) on delete cascade,
  line_number integer,
  code text,
  ean text,
  dun text,
  description text not null,
  unit text,
  expected_qty numeric(14,3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_conferencia_bonus_queue_status on public.conferencia_bonus_queue(status);
create index if not exists idx_conferencia_bonus_queue_invoice on public.conferencia_bonus_queue(invoice_number);
create index if not exists idx_conferencia_bonus_queue_created_at on public.conferencia_bonus_queue(created_at desc);
create index if not exists idx_conferencia_bonus_queue_items_queue on public.conferencia_bonus_queue_items(queue_id);

drop trigger if exists trg_conferencia_bonus_queue_updated_at on public.conferencia_bonus_queue;
create trigger trg_conferencia_bonus_queue_updated_at
before update on public.conferencia_bonus_queue
for each row execute function public.set_updated_at();

drop trigger if exists trg_conferencia_bonus_queue_items_updated_at on public.conferencia_bonus_queue_items;
create trigger trg_conferencia_bonus_queue_items_updated_at
before update on public.conferencia_bonus_queue_items
for each row execute function public.set_updated_at();

-- ---------------------------------------------
-- RLS
-- ---------------------------------------------
alter table public.admin_users enable row level security;
alter table public.user_presence enable row level security;
alter table public.operational_events enable row level security;
alter table public.conferencia_bonus_queue enable row level security;
alter table public.conferencia_bonus_queue_items enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.purchase_order_actions enable row level security;

drop policy if exists admin_users_select_self_or_admin on public.admin_users;
create policy admin_users_select_self_or_admin on public.admin_users
for select using (auth.uid() = user_id or public.is_admin_user());

drop policy if exists admin_users_update_admin_only on public.admin_users;
create policy admin_users_update_admin_only on public.admin_users
for update using (public.is_admin_user()) with check (public.is_admin_user());

drop policy if exists user_presence_owner_all on public.user_presence;
create policy user_presence_owner_all on public.user_presence
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_presence_admin_select on public.user_presence;
create policy user_presence_admin_select on public.user_presence
for select using (public.is_admin_user());

drop policy if exists operational_events_owner_insert on public.operational_events;
create policy operational_events_owner_insert on public.operational_events
for insert with check (auth.uid() = user_id);

drop policy if exists operational_events_owner_select on public.operational_events;
create policy operational_events_owner_select on public.operational_events
for select using (auth.uid() = user_id);

drop policy if exists operational_events_admin_select on public.operational_events;
create policy operational_events_admin_select on public.operational_events
for select using (public.is_admin_user());

drop policy if exists conferencia_bonus_queue_authenticated_select on public.conferencia_bonus_queue;
create policy conferencia_bonus_queue_authenticated_select on public.conferencia_bonus_queue
for select using (auth.uid() is not null);

drop policy if exists conferencia_bonus_queue_admin_insert on public.conferencia_bonus_queue;
create policy conferencia_bonus_queue_admin_insert on public.conferencia_bonus_queue
for insert with check (public.is_admin_user());

-- Fila de bônus é um pool compartilhado: o operador "assume" uma tarefa pelo app.
-- UPDATE liberado só para admin, linha ainda não atribuída (assumir) ou a própria
-- atribuição — impede sobrescrever/sequestrar a tarefa de outro operador.
drop policy if exists conferencia_bonus_queue_admin_update on public.conferencia_bonus_queue;
create policy conferencia_bonus_queue_admin_update on public.conferencia_bonus_queue
for update
using (
  public.is_admin_user()
  or assigned_user_id is null
  or assigned_user_id = auth.uid()
)
with check (
  public.is_admin_user()
  or assigned_user_id is null
  or assigned_user_id = auth.uid()
);

drop policy if exists conferencia_bonus_queue_items_authenticated_select on public.conferencia_bonus_queue_items;
create policy conferencia_bonus_queue_items_authenticated_select on public.conferencia_bonus_queue_items
for select using (auth.uid() is not null);

drop policy if exists conferencia_bonus_queue_items_admin_insert on public.conferencia_bonus_queue_items;
create policy conferencia_bonus_queue_items_admin_insert on public.conferencia_bonus_queue_items
for insert with check (public.is_admin_user());

drop policy if exists conferencia_bonus_queue_items_admin_update on public.conferencia_bonus_queue_items;
create policy conferencia_bonus_queue_items_admin_update on public.conferencia_bonus_queue_items
for update using (public.is_admin_user()) with check (public.is_admin_user());

drop policy if exists purchase_orders_admin_select on public.purchase_orders;
create policy purchase_orders_admin_select on public.purchase_orders
for select using (public.is_admin_user());

drop policy if exists purchase_orders_admin_insert on public.purchase_orders;
create policy purchase_orders_admin_insert on public.purchase_orders
for insert with check (public.is_admin_user());

drop policy if exists purchase_orders_admin_update on public.purchase_orders;
create policy purchase_orders_admin_update on public.purchase_orders
for update using (public.is_admin_user()) with check (public.is_admin_user());

drop policy if exists purchase_order_items_admin_select on public.purchase_order_items;
create policy purchase_order_items_admin_select on public.purchase_order_items
for select using (public.is_admin_user());

drop policy if exists purchase_order_items_admin_insert on public.purchase_order_items;
create policy purchase_order_items_admin_insert on public.purchase_order_items
for insert with check (public.is_admin_user());

drop policy if exists purchase_order_items_admin_update on public.purchase_order_items;
create policy purchase_order_items_admin_update on public.purchase_order_items
for update using (public.is_admin_user()) with check (public.is_admin_user());

drop policy if exists purchase_order_actions_admin_select on public.purchase_order_actions;
create policy purchase_order_actions_admin_select on public.purchase_order_actions
for select using (public.is_admin_user());

drop policy if exists purchase_order_actions_admin_insert on public.purchase_order_actions;
create policy purchase_order_actions_admin_insert on public.purchase_order_actions
for insert with check (public.is_admin_user());

-- ---------------------------------------------
-- Admin read policies on existing operational tables
-- ---------------------------------------------
drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles
for select using (public.is_admin_user());

drop policy if exists user_settings_select_admin on public.user_settings;
create policy user_settings_select_admin on public.user_settings
for select using (public.is_admin_user());

drop policy if exists validade_products_select_admin on public.validade_products;
create policy validade_products_select_admin on public.validade_products
for select using (public.is_admin_user());

drop policy if exists recebimento_treatment_cases_select_admin on public.recebimento_treatment_cases;
create policy recebimento_treatment_cases_select_admin on public.recebimento_treatment_cases
for select using (public.is_admin_user());

drop policy if exists avaria_batches_select_admin on public.avaria_batches;
create policy avaria_batches_select_admin on public.avaria_batches
for select using (public.is_admin_user());

drop policy if exists avaria_items_select_admin on public.avaria_items;
create policy avaria_items_select_admin on public.avaria_items
for select using (public.is_admin_user());

drop policy if exists conferencia_recebimentos_select_admin on public.conferencia_recebimentos;
create policy conferencia_recebimentos_select_admin on public.conferencia_recebimentos
for select using (public.is_admin_user());

drop policy if exists conferencia_saidas_select_admin on public.conferencia_saidas;
create policy conferencia_saidas_select_admin on public.conferencia_saidas
for select using (public.is_admin_user());

drop policy if exists conferencia_divergencias_select_admin on public.conferencia_divergencias;
create policy conferencia_divergencias_select_admin on public.conferencia_divergencias
for select using (public.is_admin_user());

drop policy if exists purchase_orders_select_admin on public.purchase_orders;
create policy purchase_orders_select_admin on public.purchase_orders
for select using (public.is_admin_user());

drop policy if exists purchase_order_items_select_admin on public.purchase_order_items;
create policy purchase_order_items_select_admin on public.purchase_order_items
for select using (public.is_admin_user());

drop policy if exists purchase_order_actions_select_admin on public.purchase_order_actions;
create policy purchase_order_actions_select_admin on public.purchase_order_actions
for select using (public.is_admin_user());

-- ---------------------------------------------
-- Views for admin panel
-- ---------------------------------------------
create or replace view public.admin_active_users_view as
select
  up.session_id,
  up.user_id,
  p.name,
  p.email,
  up.device_label,
  up.platform,
  up.app_version,
  up.current_module,
  up.current_screen,
  up.current_order_ref,
  up.current_batch_ref,
  up.status,
  up.signed_in_at,
  up.last_heartbeat_at,
  up.signed_out_at,
  up.metadata
from public.user_presence up
left join public.profiles p on p.user_id = up.user_id
where up.status in ('online', 'idle')
order by up.last_heartbeat_at desc;

create or replace view public.admin_tratativas_view as
select
  rtc.user_id,
  p.name as user_name,
  p.email as user_email,
  rtc.id,
  rtc.doc_number,
  rtc.supplier_code,
  rtc.origin_invoice_number,
  rtc.return_invoice_number,
  rtc.status,
  rtc.occurrence_type,
  rtc.resolution_type,
  rtc.affected_quantity,
  rtc.expected_quantity,
  rtc.received_quantity,
  rtc.product_snapshot,
  rtc.opened_at,
  rtc.started_at,
  rtc.expected_end_at,
  rtc.closed_at,
  rtc.status_updated_at,
  rtc.created_at,
  rtc.updated_at
from public.recebimento_treatment_cases rtc
left join public.profiles p on p.user_id = rtc.user_id
order by rtc.updated_at desc;

create or replace view public.admin_validade_products_view as
select
  vp.user_id,
  p.name as user_name,
  p.email as user_email,
  vp.id,
  vp.codprod,
  vp.codauxiliar,
  vp.descricao,
  vp.lote,
  vp.validade,
  vp.quantidade,
  vp.diasrestantes,
  vp.location,
  vp.status,
  vp.treatment_type,
  vp.treatment_quantity,
  vp.treatment_date,
  vp.created_at,
  vp.updated_at
from public.validade_products vp
left join public.profiles p on p.user_id = vp.user_id
order by vp.updated_at desc;

create or replace view public.admin_avaria_items_view as
select
  ai.user_id,
  p.name as user_name,
  p.email as user_email,
  ab.id as batch_id,
  ab.status as batch_status,
  ab.bonus_type as batch_bonus_type,
  ab.notes as batch_notes,
  ab.created_at as batch_created_at,
  ab.updated_at as batch_updated_at,
  ai.id as item_id,
  ai.codprod,
  ai.descricao,
  ai.quantidade,
  ai.lote,
  ai.damage_type,
  ai.resolution_type,
  ai.bonus_type,
  ai.status as item_status,
  ai.created_at as item_created_at,
  ai.updated_at as item_updated_at
from public.avaria_items ai
join public.avaria_batches ab
  on ab.user_id = ai.user_id
 and ab.id = ai.batch_id
left join public.profiles p on p.user_id = ai.user_id
order by ai.updated_at desc;

create or replace view public.admin_conferencia_recebimentos_view as
select
  cr.user_id,
  p.name as user_name,
  p.email as user_email,
  cr.id,
  cr.created_at,
  cr.updated_at,
  cr.payload ->> 'type' as type,
  cr.payload ->> 'supplier' as supplier,
  cr.payload ->> 'invoice' as invoice,
  cr.payload ->> 'conferente' as conferente,
  cr.payload ->> 'sync_status' as sync_status,
  coalesce(jsonb_array_length(cr.payload -> 'items'), 0) as items_count,
  coalesce((cr.payload -> 'totals' ->> 'divergences')::int, 0) as divergences_count,
  cr.payload
from public.conferencia_recebimentos cr
left join public.profiles p on p.user_id = cr.user_id
order by cr.updated_at desc;

create or replace view public.admin_conferencia_saidas_view as
select
  cs.user_id,
  p.name as user_name,
  p.email as user_email,
  cs.id,
  cs.created_at,
  cs.updated_at,
  cs.payload ->> 'type' as type,
  cs.payload ->> 'orderCode' as order_code,
  cs.payload ->> 'separador' as separador,
  cs.payload ->> 'embalador' as embalador,
  cs.payload ->> 'sync_status' as sync_status,
  coalesce(jsonb_array_length(cs.payload -> 'items'), 0) as items_count,
  coalesce((cs.payload -> 'totals' ->> 'divergences')::int, 0) as divergences_count,
  cs.payload
from public.conferencia_saidas cs
left join public.profiles p on p.user_id = cs.user_id
order by cs.updated_at desc;

create or replace view public.admin_conferencia_bonus_queue_view as
select
  cbq.id,
  cbq.source_type,
  cbq.invoice_key,
  cbq.invoice_number,
  cbq.supplier_name,
  cbq.supplier_code,
  cbq.supplier_document,
  cbq.issued_at,
  cbq.item_count,
  cbq.total_quantity,
  cbq.status,
  cbq.assigned_user_id,
  cbq.assigned_user_name,
  cbq.started_at,
  cbq.finished_at,
  cbq.created_at,
  cbq.updated_at,
  p.name as imported_by_name,
  p.email as imported_by_email
from public.conferencia_bonus_queue cbq
left join public.profiles p on p.user_id = cbq.imported_by
order by cbq.created_at desc;

create or replace view public.admin_purchase_orders_view as
select
  po.id,
  po.order_number,
  po.source_type,
  po.supplier_name,
  po.supplier_code,
  po.supplier_document,
  po.invoice_number,
  po.invoice_key,
  po.issued_at,
  po.status,
  po.entry_status,
  po.bonus_status,
  po.return_status,
  po.audit_status,
  po.item_count,
  po.total_quantity,
  po.reprint_count,
  po.last_reprint_at,
  po.entry_at,
  po.bonus_generated_at,
  po.return_requested_at,
  po.return_completed_at,
  po.audited_at,
  po.closed_at,
  po.created_at,
  po.updated_at,
  po.created_by,
  p.name as created_by_name,
  p.email as created_by_email
from public.purchase_orders po
left join public.profiles p on p.user_id = po.created_by
order by po.created_at desc;

create or replace view public.admin_purchase_order_actions_view as
select
  poa.id,
  poa.order_id,
  poa.created_by,
  p.name as created_by_name,
  p.email as created_by_email,
  po.order_number,
  po.invoice_number,
  po.supplier_name,
  poa.action_type,
  poa.action_label,
  poa.notes,
  poa.payload,
  poa.created_at
from public.purchase_order_actions poa
join public.purchase_orders po on po.id = poa.order_id
left join public.profiles p on p.user_id = poa.created_by
order by poa.created_at desc;

create or replace view public.admin_dashboard_summary_view as
select
  (select count(*) from public.user_presence up where up.status in ('online', 'idle')) as active_users,
  (select count(*) from public.recebimento_treatment_cases rtc where rtc.status in ('ABERTA', 'EM ANDAMENTO', 'AGUARDANDO')) as open_tratativas,
  (select count(*) from public.validade_products vp where coalesce(vp.status, 'active') = 'active') as active_validade_products,
  (select count(*) from public.avaria_batches ab where ab.status = 'open') as open_avaria_batches,
  (select count(*) from public.avaria_items ai where ai.status = 'damaged') as open_avaria_items,
  (select count(*) from public.conferencia_bonus_queue cbq where cbq.status in ('nao_iniciado', 'em_conferencia')) as open_bonus_queue,
  (select count(*) from public.conferencia_divergencias cd where coalesce(cd.payload ->> 'status', '') <> 'resolvida') as pending_divergencias;

-- ---------------------------------------------
-- Bootstrap note
-- ---------------------------------------------
-- Após rodar este arquivo, promova o primeiro admin manualmente:
-- insert into public.admin_users (user_id, role) values ('UUID_DO_USUARIO', 'admin');
