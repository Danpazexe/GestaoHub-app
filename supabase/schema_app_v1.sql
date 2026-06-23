-- =============================================
-- Gestão Hub - Schema relacional (v1)
-- =============================================
-- Execute este arquivo no SQL Editor do Supabase.

create extension if not exists pgcrypto;

-- ---------------------------------------------
-- Utilitários
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

-- ---------------------------------------------
-- Perfil do usuário (cadastro/login via Supabase Auth)
-- ---------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (user_id) do update
  set
    name = excluded.name,
    email = excluded.email,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

-- ---------------------------------------------
-- Configurações por usuário
-- ---------------------------------------------
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dark_mode boolean not null default false,
  biometric_enabled boolean not null default false,
  auto_backup boolean not null default false,
  notification_enabled boolean not null default true,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_user_settings_updated_at on public.user_settings;
create trigger trg_user_settings_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

-- ---------------------------------------------
-- Módulo Validade (lista sincronizada)
-- ---------------------------------------------
create table if not exists public.validade_products (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  codprod text,
  descricao text not null,
  codauxiliar text,
  lote text,
  validade timestamptz,
  quantidade integer not null default 0,
  diasrestantes integer,
  image_path text,
  location jsonb not null default '{}'::jsonb,
  status text not null default 'active', -- active | treated | resolved
  treatment_type text,                   -- sold | exchanged | returned | expired | unknown
  treatment_quantity integer,
  treatment_date timestamptz,
  treatment_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists idx_validade_products_user on public.validade_products(user_id);
create index if not exists idx_validade_products_codprod on public.validade_products(user_id, codprod);
create index if not exists idx_validade_products_codauxiliar on public.validade_products(user_id, codauxiliar);
create index if not exists idx_validade_products_status on public.validade_products(user_id, status);

alter table if exists public.validade_products
add column if not exists location jsonb not null default '{}'::jsonb;

drop trigger if exists trg_validade_products_updated_at on public.validade_products;
create trigger trg_validade_products_updated_at
before update on public.validade_products
for each row execute function public.set_updated_at();

-- ---------------------------------------------
-- Módulo Tratativas de Recebimento (espelho avulso)
-- ---------------------------------------------
create table if not exists public.recebimento_treatment_cases (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_number text not null,
  supplier_code text, -- nullable: casos de espelho/recebimento sem código de fornecedor
  doc_sequence_number integer,
  origin_invoice_number text,
  return_invoice_number text,
  status text not null default 'ABERTA', -- ABERTA | EM ANDAMENTO | AGUARDANDO | ENCERRADA | CANCELADA
  status_updated_at timestamptz not null default now(),
  occurrence_type text not null default 'avaria', -- avaria | falta | outro
  resolution_type text not null default 'devolucao', -- devolucao | troca | tratativa | descarte
  affected_quantity integer not null default 0,
  expected_quantity integer not null default 0,
  received_quantity integer not null default 0,
  product_snapshot jsonb not null default '{}'::jsonb,
  opened_at timestamptz not null default now(),
  started_at timestamptz,
  expected_end_at timestamptz,
  closed_at timestamptz,
  reasons text[] not null default '{}'::text[],
  handling_methods text[] not null default '{}'::text[],
  reason text,
  handling_method text,
  observation text,
  authorized_by text,
  collected_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table if exists public.recebimento_treatment_cases
add column if not exists reasons text[] not null default '{}'::text[];

alter table if exists public.recebimento_treatment_cases
add column if not exists handling_methods text[] not null default '{}'::text[];

alter table if exists public.recebimento_treatment_cases
add column if not exists supplier_code text;

alter table if exists public.recebimento_treatment_cases
add column if not exists doc_sequence_number integer;

alter table if exists public.recebimento_treatment_cases
add column if not exists occurrence_type text not null default 'avaria';

alter table if exists public.recebimento_treatment_cases
add column if not exists expected_quantity integer not null default 0;

alter table if exists public.recebimento_treatment_cases
add column if not exists received_quantity integer not null default 0;

create index if not exists idx_recebimento_treatment_cases_user on public.recebimento_treatment_cases(user_id);
create index if not exists idx_recebimento_treatment_cases_status on public.recebimento_treatment_cases(user_id, status);
create index if not exists idx_recebimento_treatment_cases_origin_invoice on public.recebimento_treatment_cases(user_id, origin_invoice_number);
create index if not exists idx_recebimento_treatment_cases_supplier_code on public.recebimento_treatment_cases(user_id, supplier_code);

drop trigger if exists trg_recebimento_treatment_cases_updated_at on public.recebimento_treatment_cases;
create trigger trg_recebimento_treatment_cases_updated_at
before update on public.recebimento_treatment_cases
for each row execute function public.set_updated_at();

-- ---------------------------------------------
-- Módulo Avaria
-- ---------------------------------------------
create table if not exists public.avaria_batches (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  bonus_type text,
  notes text,
  status text not null default 'open', -- open | concluded
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.avaria_items (
  id text not null,
  batch_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  descricao text not null,
  codprod text,
  quantidade integer not null default 0,
  lote text,
  damage_type text,
  resolution_type text,
  bonus_type text,
  status text not null default 'damaged', -- damaged | resolved
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  foreign key (user_id, batch_id) references public.avaria_batches(user_id, id) on delete cascade
);

create index if not exists idx_avaria_batches_user on public.avaria_batches(user_id);
create index if not exists idx_avaria_items_user on public.avaria_items(user_id);
create index if not exists idx_avaria_items_batch on public.avaria_items(batch_id);

drop trigger if exists trg_avaria_batches_updated_at on public.avaria_batches;
create trigger trg_avaria_batches_updated_at
before update on public.avaria_batches
for each row execute function public.set_updated_at();

drop trigger if exists trg_avaria_items_updated_at on public.avaria_items;
create trigger trg_avaria_items_updated_at
before update on public.avaria_items
for each row execute function public.set_updated_at();

-- ---------------------------------------------
-- Módulo Conferência
-- ---------------------------------------------
create table if not exists public.conferencia_recebimentos (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.conferencia_saidas (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.conferencia_divergencias (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists idx_conferencia_recebimentos_user on public.conferencia_recebimentos(user_id);
create index if not exists idx_conferencia_saidas_user on public.conferencia_saidas(user_id);
create index if not exists idx_conferencia_divergencias_user on public.conferencia_divergencias(user_id);

drop trigger if exists trg_conferencia_recebimentos_updated_at on public.conferencia_recebimentos;
create trigger trg_conferencia_recebimentos_updated_at
before update on public.conferencia_recebimentos
for each row execute function public.set_updated_at();

drop trigger if exists trg_conferencia_saidas_updated_at on public.conferencia_saidas;
create trigger trg_conferencia_saidas_updated_at
before update on public.conferencia_saidas
for each row execute function public.set_updated_at();

drop trigger if exists trg_conferencia_divergencias_updated_at on public.conferencia_divergencias;
create trigger trg_conferencia_divergencias_updated_at
before update on public.conferencia_divergencias
for each row execute function public.set_updated_at();

-- ---------------------------------------------
-- Recebimento / Pedidos de compra
-- ---------------------------------------------
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  order_number text not null unique,
  source_type text not null default 'xml_nf', -- xml_nf | manual | avulso
  supplier_name text not null,
  supplier_code text,
  supplier_document text,
  invoice_number text,
  invoice_key text,
  issued_at timestamptz,
  status text not null default 'pedido_criado', -- pedido_criado | entrada_pendente | entrada_realizada | bonus_gerado | devolucao_pendente | devolucao_emitida | auditado | encerrado | cancelado
  entry_status text not null default 'pendente', -- pendente | parcial | realizada
  bonus_status text not null default 'nao_gerado', -- nao_gerado | gerado
  return_status text not null default 'sem_devolucao', -- sem_devolucao | pendente | emitida
  audit_status text not null default 'pendente', -- pendente | revisado | aprovado
  item_count integer not null default 0,
  total_quantity numeric(14,3) not null default 0,
  reprint_count integer not null default 0,
  last_reprint_at timestamptz,
  entry_at timestamptz,
  bonus_generated_at timestamptz,
  return_requested_at timestamptz,
  return_completed_at timestamptz,
  audited_at timestamptz,
  closed_at timestamptz,
  xml_payload jsonb not null default '{}'::jsonb,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.purchase_orders(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  line_number integer,
  code text,
  ean text,
  dun text,
  description text not null,
  unit text,
  expected_qty numeric(14,3) not null default 0,
  received_qty numeric(14,3) not null default 0,
  divergence_qty numeric(14,3) not null default 0,
  packaging_options jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_order_actions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.purchase_orders(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  action_type text not null, -- pedido_criado | entrada_realizada | bonus_gerado | devolucao_pendente | devolucao_emitida | reimpressao | auditoria
  action_label text,
  notes text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_purchase_orders_created_by on public.purchase_orders(created_by);
create index if not exists idx_purchase_orders_status on public.purchase_orders(status);
create index if not exists idx_purchase_orders_invoice_number on public.purchase_orders(invoice_number);
create index if not exists idx_purchase_orders_created_at on public.purchase_orders(created_at desc);
create index if not exists idx_purchase_order_items_order on public.purchase_order_items(order_id);
create index if not exists idx_purchase_order_actions_order on public.purchase_order_actions(order_id, created_at desc);

drop trigger if exists trg_purchase_orders_updated_at on public.purchase_orders;
create trigger trg_purchase_orders_updated_at
before update on public.purchase_orders
for each row execute function public.set_updated_at();

drop trigger if exists trg_purchase_order_items_updated_at on public.purchase_order_items;
create trigger trg_purchase_order_items_updated_at
before update on public.purchase_order_items
for each row execute function public.set_updated_at();

-- ---------------------------------------------
-- Storage bucket (imagens)
-- ---------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', false)
on conflict (id) do nothing;

-- ---------------------------------------------
-- RLS
-- ---------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.validade_products enable row level security;
alter table public.recebimento_treatment_cases enable row level security;
alter table public.avaria_batches enable row level security;
alter table public.avaria_items enable row level security;
alter table public.conferencia_recebimentos enable row level security;
alter table public.conferencia_saidas enable row level security;
alter table public.conferencia_divergencias enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.purchase_order_actions enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select using (auth.uid() = user_id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
for insert with check (auth.uid() = user_id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists settings_select_own on public.user_settings;
create policy settings_select_own on public.user_settings
for select using (auth.uid() = user_id);

drop policy if exists settings_upsert_own on public.user_settings;
create policy settings_upsert_own on public.user_settings
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists validade_products_owner_all on public.validade_products;
create policy validade_products_owner_all on public.validade_products
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists recebimento_treatment_cases_owner_all on public.recebimento_treatment_cases;
create policy recebimento_treatment_cases_owner_all on public.recebimento_treatment_cases
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists avaria_batches_owner_all on public.avaria_batches;
create policy avaria_batches_owner_all on public.avaria_batches
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists avaria_items_owner_all on public.avaria_items;
create policy avaria_items_owner_all on public.avaria_items
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists conferencia_recebimentos_owner_all on public.conferencia_recebimentos;
create policy conferencia_recebimentos_owner_all on public.conferencia_recebimentos
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists conferencia_saidas_owner_all on public.conferencia_saidas;
create policy conferencia_saidas_owner_all on public.conferencia_saidas
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists conferencia_divergencias_owner_all on public.conferencia_divergencias;
create policy conferencia_divergencias_owner_all on public.conferencia_divergencias
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists purchase_orders_owner_all on public.purchase_orders;
create policy purchase_orders_owner_all on public.purchase_orders
for all using (auth.uid() = created_by) with check (auth.uid() = created_by);

drop policy if exists purchase_order_items_owner_all on public.purchase_order_items;
create policy purchase_order_items_owner_all on public.purchase_order_items
for all using (auth.uid() = created_by) with check (auth.uid() = created_by);

drop policy if exists purchase_order_actions_owner_all on public.purchase_order_actions;
create policy purchase_order_actions_owner_all on public.purchase_order_actions
for all using (auth.uid() = created_by) with check (auth.uid() = created_by);

-- Storage policies (bucket product-images)
drop policy if exists storage_read_own_product_images on storage.objects;
create policy storage_read_own_product_images
on storage.objects for select
using (
  bucket_id = 'product-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists storage_insert_own_product_images on storage.objects;
create policy storage_insert_own_product_images
on storage.objects for insert
with check (
  bucket_id = 'product-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists storage_update_own_product_images on storage.objects;
create policy storage_update_own_product_images
on storage.objects for update
using (
  bucket_id = 'product-images'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'product-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists storage_delete_own_product_images on storage.objects;
create policy storage_delete_own_product_images
on storage.objects for delete
using (
  bucket_id = 'product-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);
