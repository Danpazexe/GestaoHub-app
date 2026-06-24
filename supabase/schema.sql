-- =============================================================================
-- Gestão Hub — Schema canônico consolidado
-- =============================================================================
-- Este é o SCHEMA CANÔNICO ÚNICO do projeto. Ele representa o ESTADO FINAL do
-- banco após aplicar, em ordem, todo o histórico de migrations:
--
--     schema_app_v1.sql      → tabelas operacionais (app)
--     schema_admin_panel_v1.sql → painel admin, presença, auditoria, fila de bônus, views
--     schema_fixes_v2.sql    → policies de escrita do admin, force sign-out, colunas
--                              avaria (supplier/resolution_note), janela de presença 150s
--     schema_fixes_v3.sql    → segurança: views com security_invoker=on, UPDATE seguro
--                              da fila de bônus, supplier_code nullable
--     schema_fixes_v4.sql    → CHECKs de domínio (NOT VALID) + índices faltantes
--
-- Os arquivos schema_*_v*.sql permanecem no repositório APENAS como histórico de
-- migrations. Este schema.sql é a fonte de verdade: rode-o sozinho numa DB nova
-- (Postgres 15+, projeto Supabase) e reproduz o estado atual completo.
--
-- Diferenças vs. histórico (estado final dobrado dentro dos CREATE TABLE):
--   - recebimento_treatment_cases.supplier_code já NASCE nullable (fixes_v3).
--   - avaria_batches.supplier e avaria_items.resolution_note já são colunas (fixes_v2).
--   - recebimento_treatment_cases tem occurrence_type / expected_quantity /
--     received_quantity / reasons / handling_methods / doc_sequence_number já presentes.
--   - set_updated_at() e create extension pgcrypto definidos UMA única vez.
--   - Views admin_* na forma final (security_invoker=on + janela 150s + supplier/resolution_note).
--   - Policy de UPDATE de conferencia_bonus_queue na forma SEGURA (admin / livre / própria).
--   - CHECKs de domínio adicionados como NOT VALID (travam escrita nova; não varrem legado).
--
-- Convenções:
--   - Idempotente onde natural: create extension/table/index if not exists;
--     create or replace function/view; drop policy if exists antes de create.
--   - Toda persistência no schema public; auth via auth.users (Supabase Auth).
--   - PK composta (user_id, id) com id text nas tabelas sincronizadas do app
--     (ID gerado no cliente). PK uuid nas tabelas geradas no servidor.
--
-- Organização por DOMÍNIO:
--   0. Extensões e utilitários (compartilhados)
--   1. Auth / Perfil
--   2. Presença / Auditoria
--   3. Validade
--   4. Avaria
--   5. Conferência
--   6. Recebimento / Tratativas
--   7. Compras / Purchase Orders
--   8. Admin (papéis, fila de bônus, views, storage)
-- =============================================================================


-- =============================================================================
-- 0. EXTENSÕES E UTILITÁRIOS (compartilhados por todos os domínios)
-- =============================================================================

-- pgcrypto fornece gen_random_uuid() usado nas PKs uuid.
create extension if not exists pgcrypto;

-- Trigger genérico de updated_at, usado por todas as tabelas com a coluna.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- admin_users define quem é admin/supervisor/auditor. Precisa existir ANTES de
-- is_admin_user(): a função é `language sql` e tem o corpo validado já no CREATE
-- (check_function_bodies = on, padrão no Postgres/Supabase), então referenciar uma
-- tabela inexistente abortaria o script numa DB nova. Por isso a TABELA vive aqui
-- no domínio 0; a RLS e as policies dela ficam no domínio 8.
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

-- is_admin_user(): base de TODA a RLS de admin. Retorna true se o usuário
-- corrente (auth.uid()) possui linha em admin_users. SECURITY DEFINER para
-- conseguir ler admin_users mesmo sob RLS do chamador.
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


-- =============================================================================
-- 1. AUTH / PERFIL
--    profiles, user_settings — owner-scoped por user_id (= auth.users).
-- =============================================================================

-- Perfil do usuário (populado automaticamente a partir de auth.users via trigger).
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

-- AFTER INSERT em auth.users: cria/upsert o perfil com nome e e-mail.
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

-- Preferências por usuário (1:1).
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


-- =============================================================================
-- 2. PRESENÇA / AUDITORIA
--    user_presence (sessões/heartbeat), operational_events (log append-only).
-- =============================================================================

-- Sessão ativa do app (heartbeat ~45s; janela de frescor = 150s nas views).
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

-- Log append-only de eventos operacionais (auditoria). Sem updated_at.
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
create index if not exists idx_operational_events_session on public.operational_events(session_id);


-- =============================================================================
-- 3. VALIDADE
--    validade_products — lista de validade (produtos ativos e tratados).
-- =============================================================================

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
-- relatórios de tratativa agrupam por tipo (fixes_v4):
create index if not exists idx_validade_products_treatment_type on public.validade_products(user_id, treatment_type);

drop trigger if exists trg_validade_products_updated_at on public.validade_products;
create trigger trg_validade_products_updated_at
before update on public.validade_products
for each row execute function public.set_updated_at();


-- =============================================================================
-- 4. AVARIA
--    avaria_batches (lote) + avaria_items (item) — FK composta (user_id, batch_id).
--    supplier (batches) e resolution_note (items) já nascem como colunas (fixes_v2).
-- =============================================================================

create table if not exists public.avaria_batches (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  supplier text, -- fornecedor (fixes_v2: antes era perdido no sync)
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
  resolution_note text, -- nota de resolução (fixes_v2)
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
-- status indexados para o dashboard (open_avaria_batches / open_avaria_items) — fixes_v4:
create index if not exists idx_avaria_batches_status on public.avaria_batches(user_id, status);
create index if not exists idx_avaria_items_status on public.avaria_items(user_id, status);

drop trigger if exists trg_avaria_batches_updated_at on public.avaria_batches;
create trigger trg_avaria_batches_updated_at
before update on public.avaria_batches
for each row execute function public.set_updated_at();

drop trigger if exists trg_avaria_items_updated_at on public.avaria_items;
create trigger trg_avaria_items_updated_at
before update on public.avaria_items
for each row execute function public.set_updated_at();


-- =============================================================================
-- 5. CONFERÊNCIA
--    Três tabelas estruturalmente idênticas; o negócio mora no payload jsonb.
--    (A fila de bônus compartilhada vive no domínio Admin.)
-- =============================================================================

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


-- =============================================================================
-- 6. RECEBIMENTO / TRATATIVAS
--    recebimento_treatment_cases — espelho oficial de ocorrência de recebimento.
--    Estado final: supplier_code nullable, occurrence_type/expected_quantity/
--    received_quantity/reasons/handling_methods/doc_sequence_number já presentes.
-- =============================================================================

create table if not exists public.recebimento_treatment_cases (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_number text not null,
  supplier_code text, -- nullable (fixes_v3): casos de espelho/recebimento sem código de fornecedor
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
  reason text,            -- legado/compat (fonte de verdade é reasons[])
  handling_method text,   -- legado/compat (fonte de verdade é handling_methods[])
  observation text,
  authorized_by text,
  collected_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists idx_recebimento_treatment_cases_user on public.recebimento_treatment_cases(user_id);
create index if not exists idx_recebimento_treatment_cases_status on public.recebimento_treatment_cases(user_id, status);
create index if not exists idx_recebimento_treatment_cases_origin_invoice on public.recebimento_treatment_cases(user_id, origin_invoice_number);
create index if not exists idx_recebimento_treatment_cases_supplier_code on public.recebimento_treatment_cases(user_id, supplier_code);

drop trigger if exists trg_recebimento_treatment_cases_updated_at on public.recebimento_treatment_cases;
create trigger trg_recebimento_treatment_cases_updated_at
before update on public.recebimento_treatment_cases
for each row execute function public.set_updated_at();


-- =============================================================================
-- 7. COMPRAS / PURCHASE ORDERS
--    purchase_orders + purchase_order_items + purchase_order_actions.
--    Owner-scoped por created_by; criadas pelo admin (XML de NF / manual / avulso).
-- =============================================================================

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
-- listagem do painel ordena por (created_by, created_at) — fixes_v4:
create index if not exists idx_purchase_orders_created_by_created_at on public.purchase_orders(created_by, created_at desc);
create index if not exists idx_purchase_order_items_order on public.purchase_order_items(order_id);
-- RLS/owner filtra purchase_order_items por created_by — fixes_v4:
create index if not exists idx_purchase_order_items_created_by on public.purchase_order_items(created_by);
create index if not exists idx_purchase_order_actions_order on public.purchase_order_actions(order_id, created_at desc);

drop trigger if exists trg_purchase_orders_updated_at on public.purchase_orders;
create trigger trg_purchase_orders_updated_at
before update on public.purchase_orders
for each row execute function public.set_updated_at();

drop trigger if exists trg_purchase_order_items_updated_at on public.purchase_order_items;
create trigger trg_purchase_order_items_updated_at
before update on public.purchase_order_items
for each row execute function public.set_updated_at();


-- =============================================================================
-- 8. ADMIN (papéis, fila de bônus, RPC, views, storage)
-- =============================================================================

-- ---------------------------------------------
-- 8.1 admin_users — a TABELA é criada no domínio 0 (precisa existir antes de
--     is_admin_user()). Aqui ficam apenas a RLS e as policies dela (abaixo).
--     A presença de uma linha em admin_users faz is_admin_user() retornar true.
-- ---------------------------------------------

-- ---------------------------------------------
-- 8.2 Fila de bônus / importação de XML de NF (pool compartilhado).
-- ---------------------------------------------
create table if not exists public.conferencia_bonus_queue (
  id uuid primary key default gen_random_uuid(),
  source_type text not null default 'xml_nf', -- xml_nf | manual | purchase_order | recebimento
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
-- UI lista "minhas tarefas" e a RLS de update compara por assigned_user_id — fixes_v4:
create index if not exists idx_conferencia_bonus_queue_assigned_user on public.conferencia_bonus_queue(assigned_user_id);
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
-- 8.2.1 Fila de bônus de SAÍDA (conferência de expedição/pedido — análogo ao
--       Winthor rotina 3854). Tabela SEPARADA da de entrada para isolar os
--       fluxos. O conferente bipa/digita o order_code para entrar no bônus.
--       carga_code fica preparado para agrupamento por carga (não usado ainda).
-- ---------------------------------------------
create table if not exists public.conferencia_saida_bonus_queue (
  id uuid primary key default gen_random_uuid(),
  source_type text not null default 'manual', -- manual (montado no painel)
  order_code text not null,                    -- número bipavel do pedido (QR/cód.barras/número)
  order_key text,                              -- order_code normalizado (dedup de bônus em aberto)
  carga_code text,                             -- agrupamento por carga (futuro)
  customer_name text,                          -- cliente / destino (opcional)
  customer_code text,
  route_code text,                             -- rota (opcional)
  item_count integer not null default 0,
  total_quantity numeric(14,3) not null default 0,
  status text not null default 'nao_iniciado', -- nao_iniciado | em_conferencia | finalizada | saida_realizada | cancelada
  imported_by uuid references auth.users(id) on delete set null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  assigned_user_name text,
  imported_payload jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conferencia_saida_bonus_queue_items (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.conferencia_saida_bonus_queue(id) on delete cascade,
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

create index if not exists idx_conferencia_saida_bonus_queue_status on public.conferencia_saida_bonus_queue(status);
create index if not exists idx_conferencia_saida_bonus_queue_order on public.conferencia_saida_bonus_queue(order_code);
create index if not exists idx_conferencia_saida_bonus_queue_created_at on public.conferencia_saida_bonus_queue(created_at desc);
create index if not exists idx_conferencia_saida_bonus_queue_assigned_user on public.conferencia_saida_bonus_queue(assigned_user_id);
create index if not exists idx_conferencia_saida_bonus_queue_items_queue on public.conferencia_saida_bonus_queue_items(queue_id);

alter table public.conferencia_saida_bonus_queue
  drop constraint if exists ck_saida_bonus_queue_status;
alter table public.conferencia_saida_bonus_queue
  add constraint ck_saida_bonus_queue_status
  check (status in ('nao_iniciado','em_conferencia','finalizada','saida_realizada','cancelada')) not valid;

drop trigger if exists trg_conferencia_saida_bonus_queue_updated_at on public.conferencia_saida_bonus_queue;
create trigger trg_conferencia_saida_bonus_queue_updated_at
before update on public.conferencia_saida_bonus_queue
for each row execute function public.set_updated_at();

drop trigger if exists trg_conferencia_saida_bonus_queue_items_updated_at on public.conferencia_saida_bonus_queue_items;
create trigger trg_conferencia_saida_bonus_queue_items_updated_at
before update on public.conferencia_saida_bonus_queue_items
for each row execute function public.set_updated_at();

-- ---------------------------------------------
-- 8.3 RPC: force sign-out (admin força logout de outro usuário).
--     SECURITY DEFINER; retorna nº de sessões encerradas (UI distingue "sem sessão").
-- ---------------------------------------------
create or replace function public.admin_force_sign_out(target_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if not public.is_admin_user() then
    raise exception 'not authorized';
  end if;

  update public.user_presence
     set status = 'signed_out', signed_out_at = now()
   where user_id = target_user_id
     and status <> 'signed_out';

  get diagnostics affected = row_count;
  return affected;
end;
$$;

grant execute on function public.admin_force_sign_out(uuid) to authenticated;


-- =============================================================================
-- CHECKS DE DOMÍNIO (NOT VALID)
-- -----------------------------------------------------------------------------
-- Travam o CONJUNTO de valores aceitos a partir de AGORA (toda escrita nova),
-- mas NÃO varrem linhas existentes (NOT VALID) — não recusa nem reescreve legado.
-- Conjuntos incluem valores legados conhecidos (ver notas). Para promover depois:
--     alter table public.<tabela> validate constraint <nome>;
-- (fixes_v4)
-- =============================================================================

-- recebimento_treatment_cases
alter table if exists public.recebimento_treatment_cases
  drop constraint if exists ck_rtc_status;
alter table if exists public.recebimento_treatment_cases
  add constraint ck_rtc_status
  check (status in ('ABERTA','EM ANDAMENTO','AGUARDANDO','ENCERRADA','CANCELADA'))
  not valid;

alter table if exists public.recebimento_treatment_cases
  drop constraint if exists ck_rtc_occurrence_type;
alter table if exists public.recebimento_treatment_cases
  add constraint ck_rtc_occurrence_type
  check (occurrence_type in ('avaria','falta','outro'))
  not valid;

alter table if exists public.recebimento_treatment_cases
  drop constraint if exists ck_rtc_resolution_type;
alter table if exists public.recebimento_treatment_cases
  add constraint ck_rtc_resolution_type
  check (resolution_type in (
    'devolucao','troca','tratativa','descarte',
    -- legados (tratativaCaseMapper.js): recolhimento->devolucao, reposicao->troca, abatimento->tratativa
    'recolhimento','reposicao','abatimento'
  ))
  not valid;

-- validade_products ('resolvida' é legado do web; treatment_type nullable)
alter table if exists public.validade_products
  drop constraint if exists ck_validade_status;
alter table if exists public.validade_products
  add constraint ck_validade_status
  check (status in ('active','treated','resolved','resolvida'))
  not valid;

alter table if exists public.validade_products
  drop constraint if exists ck_validade_treatment_type;
alter table if exists public.validade_products
  add constraint ck_validade_treatment_type
  check (treatment_type is null or treatment_type in (
    'sold','exchanged','returned','expired','unknown'
  ))
  not valid;

-- avaria_batches
alter table if exists public.avaria_batches
  drop constraint if exists ck_avaria_batches_status;
alter table if exists public.avaria_batches
  add constraint ck_avaria_batches_status
  check (status in ('open','concluded'))
  not valid;

alter table if exists public.avaria_batches
  drop constraint if exists ck_avaria_batches_bonus_type;
alter table if exists public.avaria_batches
  add constraint ck_avaria_batches_bonus_type
  check (bonus_type is null or bonus_type in ('merchandise','money','exchange'))
  not valid;

-- avaria_items (todos os *_type nullable)
alter table if exists public.avaria_items
  drop constraint if exists ck_avaria_items_status;
alter table if exists public.avaria_items
  add constraint ck_avaria_items_status
  check (status in ('damaged','resolved'))
  not valid;

alter table if exists public.avaria_items
  drop constraint if exists ck_avaria_items_damage_type;
alter table if exists public.avaria_items
  add constraint ck_avaria_items_damage_type
  check (damage_type is null or damage_type in (
    'broken','leaking','expired','spoiled','missing','other'
  ))
  not valid;

alter table if exists public.avaria_items
  drop constraint if exists ck_avaria_items_resolution_type;
alter table if exists public.avaria_items
  add constraint ck_avaria_items_resolution_type
  check (resolution_type is null or resolution_type in (
    'discard','supplier_return','donation','discount_sale','stock_return'
  ))
  not valid;

alter table if exists public.avaria_items
  drop constraint if exists ck_avaria_items_bonus_type;
alter table if exists public.avaria_items
  add constraint ck_avaria_items_bonus_type
  check (bonus_type is null or bonus_type in ('merchandise','money','exchange'))
  not valid;

-- conferencia_bonus_queue (source_type inclui purchase_order/recebimento)
alter table if exists public.conferencia_bonus_queue
  drop constraint if exists ck_bonus_queue_status;
alter table if exists public.conferencia_bonus_queue
  add constraint ck_bonus_queue_status
  check (status in ('nao_iniciado','em_conferencia','finalizada','entrada_realizada','cancelada'))
  not valid;

alter table if exists public.conferencia_bonus_queue
  drop constraint if exists ck_bonus_queue_source_type;
alter table if exists public.conferencia_bonus_queue
  add constraint ck_bonus_queue_source_type
  check (source_type in ('xml_nf','manual','purchase_order','recebimento'))
  not valid;

-- purchase_orders
alter table if exists public.purchase_orders
  drop constraint if exists ck_po_status;
alter table if exists public.purchase_orders
  add constraint ck_po_status
  check (status in (
    'pedido_criado','entrada_pendente','entrada_realizada','bonus_gerado',
    'devolucao_pendente','devolucao_emitida','auditado','encerrado','cancelado'
  ))
  not valid;

alter table if exists public.purchase_orders
  drop constraint if exists ck_po_entry_status;
alter table if exists public.purchase_orders
  add constraint ck_po_entry_status
  check (entry_status in ('pendente','parcial','realizada'))
  not valid;

alter table if exists public.purchase_orders
  drop constraint if exists ck_po_bonus_status;
alter table if exists public.purchase_orders
  add constraint ck_po_bonus_status
  check (bonus_status in ('nao_gerado','gerado'))
  not valid;

alter table if exists public.purchase_orders
  drop constraint if exists ck_po_return_status;
alter table if exists public.purchase_orders
  add constraint ck_po_return_status
  check (return_status in ('sem_devolucao','pendente','emitida'))
  not valid;

alter table if exists public.purchase_orders
  drop constraint if exists ck_po_audit_status;
alter table if exists public.purchase_orders
  add constraint ck_po_audit_status
  check (audit_status in ('pendente','revisado','aprovado'))
  not valid;

alter table if exists public.purchase_orders
  drop constraint if exists ck_po_source_type;
alter table if exists public.purchase_orders
  add constraint ck_po_source_type
  check (source_type in ('xml_nf','manual','avulso','purchase_order'))
  not valid;

-- purchase_order_actions.action_type
alter table if exists public.purchase_order_actions
  drop constraint if exists ck_poa_action_type;
alter table if exists public.purchase_order_actions
  add constraint ck_poa_action_type
  check (action_type in (
    'pedido_criado','entrada_realizada','bonus_gerado',
    'devolucao_pendente','devolucao_emitida','reimpressao','auditoria'
  ))
  not valid;

-- admin_users.role
alter table if exists public.admin_users
  drop constraint if exists ck_admin_users_role;
alter table if exists public.admin_users
  add constraint ck_admin_users_role
  check (role in ('admin','supervisor','auditor'))
  not valid;

-- user_presence.status
alter table if exists public.user_presence
  drop constraint if exists ck_user_presence_status;
alter table if exists public.user_presence
  add constraint ck_user_presence_status
  check (status in ('online','idle','offline','signed_out'))
  not valid;


-- =============================================================================
-- ROW LEVEL SECURITY — enable + policies (versão final de cada policy)
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.user_presence enable row level security;
alter table public.operational_events enable row level security;
alter table public.validade_products enable row level security;
alter table public.avaria_batches enable row level security;
alter table public.avaria_items enable row level security;
alter table public.conferencia_recebimentos enable row level security;
alter table public.conferencia_saidas enable row level security;
alter table public.conferencia_divergencias enable row level security;
alter table public.recebimento_treatment_cases enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.purchase_order_actions enable row level security;
alter table public.admin_users enable row level security;
alter table public.conferencia_bonus_queue enable row level security;
alter table public.conferencia_bonus_queue_items enable row level security;
alter table public.conferencia_saida_bonus_queue enable row level security;
alter table public.conferencia_saida_bonus_queue_items enable row level security;

-- ---------------------------------------------
-- Domínio 1 — profiles / user_settings
-- ---------------------------------------------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select using (auth.uid() = user_id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
for insert with check (auth.uid() = user_id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles
for select using (public.is_admin_user());

drop policy if exists settings_select_own on public.user_settings;
create policy settings_select_own on public.user_settings
for select using (auth.uid() = user_id);

drop policy if exists settings_upsert_own on public.user_settings;
create policy settings_upsert_own on public.user_settings
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_settings_select_admin on public.user_settings;
create policy user_settings_select_admin on public.user_settings
for select using (public.is_admin_user());

-- ---------------------------------------------
-- Domínio 2 — user_presence / operational_events
-- ---------------------------------------------
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

-- ---------------------------------------------
-- Domínio 3 — validade_products (dono ALL; admin SELECT + UPDATE)
-- ---------------------------------------------
drop policy if exists validade_products_owner_all on public.validade_products;
create policy validade_products_owner_all on public.validade_products
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists validade_products_select_admin on public.validade_products;
create policy validade_products_select_admin on public.validade_products
for select using (public.is_admin_user());

drop policy if exists validade_products_admin_update on public.validade_products;
create policy validade_products_admin_update on public.validade_products
for update using (public.is_admin_user()) with check (public.is_admin_user());

-- ---------------------------------------------
-- Domínio 4 — avaria_batches / avaria_items (dono ALL; admin SELECT/UPDATE/DELETE)
-- ---------------------------------------------
drop policy if exists avaria_batches_owner_all on public.avaria_batches;
create policy avaria_batches_owner_all on public.avaria_batches
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists avaria_batches_select_admin on public.avaria_batches;
create policy avaria_batches_select_admin on public.avaria_batches
for select using (public.is_admin_user());

drop policy if exists avaria_batches_admin_update on public.avaria_batches;
create policy avaria_batches_admin_update on public.avaria_batches
for update using (public.is_admin_user()) with check (public.is_admin_user());

drop policy if exists avaria_batches_admin_delete on public.avaria_batches;
create policy avaria_batches_admin_delete on public.avaria_batches
for delete using (public.is_admin_user());

drop policy if exists avaria_items_owner_all on public.avaria_items;
create policy avaria_items_owner_all on public.avaria_items
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists avaria_items_select_admin on public.avaria_items;
create policy avaria_items_select_admin on public.avaria_items
for select using (public.is_admin_user());

drop policy if exists avaria_items_admin_update on public.avaria_items;
create policy avaria_items_admin_update on public.avaria_items
for update using (public.is_admin_user()) with check (public.is_admin_user());

drop policy if exists avaria_items_admin_delete on public.avaria_items;
create policy avaria_items_admin_delete on public.avaria_items
for delete using (public.is_admin_user());

-- ---------------------------------------------
-- Domínio 5 — conferencia_* (dono ALL; admin SELECT)
-- ---------------------------------------------
drop policy if exists conferencia_recebimentos_owner_all on public.conferencia_recebimentos;
create policy conferencia_recebimentos_owner_all on public.conferencia_recebimentos
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists conferencia_recebimentos_select_admin on public.conferencia_recebimentos;
create policy conferencia_recebimentos_select_admin on public.conferencia_recebimentos
for select using (public.is_admin_user());

drop policy if exists conferencia_saidas_owner_all on public.conferencia_saidas;
create policy conferencia_saidas_owner_all on public.conferencia_saidas
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists conferencia_saidas_select_admin on public.conferencia_saidas;
create policy conferencia_saidas_select_admin on public.conferencia_saidas
for select using (public.is_admin_user());

drop policy if exists conferencia_divergencias_owner_all on public.conferencia_divergencias;
create policy conferencia_divergencias_owner_all on public.conferencia_divergencias
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists conferencia_divergencias_select_admin on public.conferencia_divergencias;
create policy conferencia_divergencias_select_admin on public.conferencia_divergencias
for select using (public.is_admin_user());

-- ---------------------------------------------
-- Domínio 6 — recebimento_treatment_cases (dono ALL; admin SELECT + UPDATE)
-- ---------------------------------------------
drop policy if exists recebimento_treatment_cases_owner_all on public.recebimento_treatment_cases;
create policy recebimento_treatment_cases_owner_all on public.recebimento_treatment_cases
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists recebimento_treatment_cases_select_admin on public.recebimento_treatment_cases;
create policy recebimento_treatment_cases_select_admin on public.recebimento_treatment_cases
for select using (public.is_admin_user());

drop policy if exists recebimento_treatment_cases_admin_update on public.recebimento_treatment_cases;
create policy recebimento_treatment_cases_admin_update on public.recebimento_treatment_cases
for update using (public.is_admin_user()) with check (public.is_admin_user());

-- ---------------------------------------------
-- Domínio 7 — purchase_orders / items / actions
--   Dono (created_by) ALL; admin SELECT + INSERT + UPDATE (actions: SELECT+INSERT).
-- ---------------------------------------------
drop policy if exists purchase_orders_owner_all on public.purchase_orders;
create policy purchase_orders_owner_all on public.purchase_orders
for all using (auth.uid() = created_by) with check (auth.uid() = created_by);

drop policy if exists purchase_orders_select_admin on public.purchase_orders;
create policy purchase_orders_select_admin on public.purchase_orders
for select using (public.is_admin_user());

drop policy if exists purchase_orders_admin_insert on public.purchase_orders;
create policy purchase_orders_admin_insert on public.purchase_orders
for insert with check (public.is_admin_user());

drop policy if exists purchase_orders_admin_update on public.purchase_orders;
create policy purchase_orders_admin_update on public.purchase_orders
for update using (public.is_admin_user()) with check (public.is_admin_user());

drop policy if exists purchase_order_items_owner_all on public.purchase_order_items;
create policy purchase_order_items_owner_all on public.purchase_order_items
for all using (auth.uid() = created_by) with check (auth.uid() = created_by);

drop policy if exists purchase_order_items_select_admin on public.purchase_order_items;
create policy purchase_order_items_select_admin on public.purchase_order_items
for select using (public.is_admin_user());

drop policy if exists purchase_order_items_admin_insert on public.purchase_order_items;
create policy purchase_order_items_admin_insert on public.purchase_order_items
for insert with check (public.is_admin_user());

drop policy if exists purchase_order_items_admin_update on public.purchase_order_items;
create policy purchase_order_items_admin_update on public.purchase_order_items
for update using (public.is_admin_user()) with check (public.is_admin_user());

drop policy if exists purchase_order_actions_owner_all on public.purchase_order_actions;
create policy purchase_order_actions_owner_all on public.purchase_order_actions
for all using (auth.uid() = created_by) with check (auth.uid() = created_by);

drop policy if exists purchase_order_actions_select_admin on public.purchase_order_actions;
create policy purchase_order_actions_select_admin on public.purchase_order_actions
for select using (public.is_admin_user());

drop policy if exists purchase_order_actions_admin_insert on public.purchase_order_actions;
create policy purchase_order_actions_admin_insert on public.purchase_order_actions
for insert with check (public.is_admin_user());

-- ---------------------------------------------
-- Domínio 8 — admin_users / fila de bônus
-- ---------------------------------------------
drop policy if exists admin_users_select_self_or_admin on public.admin_users;
create policy admin_users_select_self_or_admin on public.admin_users
for select using (auth.uid() = user_id or public.is_admin_user());

drop policy if exists admin_users_update_admin_only on public.admin_users;
create policy admin_users_update_admin_only on public.admin_users
for update using (public.is_admin_user()) with check (public.is_admin_user());

drop policy if exists conferencia_bonus_queue_authenticated_select on public.conferencia_bonus_queue;
create policy conferencia_bonus_queue_authenticated_select on public.conferencia_bonus_queue
for select using (auth.uid() is not null);

drop policy if exists conferencia_bonus_queue_admin_insert on public.conferencia_bonus_queue;
create policy conferencia_bonus_queue_admin_insert on public.conferencia_bonus_queue
for insert with check (public.is_admin_user());

-- A fila é um POOL COMPARTILHADO: o operador "assume" uma tarefa pelo app.
-- UPDATE liberado só para admin, linha ainda NÃO atribuída (assumir) ou a própria
-- atribuição — impede sequestrar/sobrescrever a tarefa de outro operador (fixes_v3).
drop policy if exists conferencia_bonus_queue_update_admin_or_assignee on public.conferencia_bonus_queue;
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

drop policy if exists conferencia_bonus_queue_admin_delete on public.conferencia_bonus_queue;
create policy conferencia_bonus_queue_admin_delete on public.conferencia_bonus_queue
for delete using (public.is_admin_user());

drop policy if exists conferencia_bonus_queue_items_authenticated_select on public.conferencia_bonus_queue_items;
create policy conferencia_bonus_queue_items_authenticated_select on public.conferencia_bonus_queue_items
for select using (auth.uid() is not null);

drop policy if exists conferencia_bonus_queue_items_admin_insert on public.conferencia_bonus_queue_items;
create policy conferencia_bonus_queue_items_admin_insert on public.conferencia_bonus_queue_items
for insert with check (public.is_admin_user());

drop policy if exists conferencia_bonus_queue_items_admin_update on public.conferencia_bonus_queue_items;
create policy conferencia_bonus_queue_items_admin_update on public.conferencia_bonus_queue_items
for update using (public.is_admin_user()) with check (public.is_admin_user());

drop policy if exists conferencia_bonus_queue_items_admin_delete on public.conferencia_bonus_queue_items;
create policy conferencia_bonus_queue_items_admin_delete on public.conferencia_bonus_queue_items
for delete using (public.is_admin_user());

-- Fila de bônus de SAÍDA — mesmas regras da de entrada: pool compartilhado,
-- UPDATE só para admin / linha não atribuída / própria atribuição.
drop policy if exists conferencia_saida_bonus_queue_authenticated_select on public.conferencia_saida_bonus_queue;
create policy conferencia_saida_bonus_queue_authenticated_select on public.conferencia_saida_bonus_queue
for select using (auth.uid() is not null);

drop policy if exists conferencia_saida_bonus_queue_admin_insert on public.conferencia_saida_bonus_queue;
create policy conferencia_saida_bonus_queue_admin_insert on public.conferencia_saida_bonus_queue
for insert with check (public.is_admin_user());

drop policy if exists conferencia_saida_bonus_queue_admin_update on public.conferencia_saida_bonus_queue;
create policy conferencia_saida_bonus_queue_admin_update on public.conferencia_saida_bonus_queue
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

drop policy if exists conferencia_saida_bonus_queue_admin_delete on public.conferencia_saida_bonus_queue;
create policy conferencia_saida_bonus_queue_admin_delete on public.conferencia_saida_bonus_queue
for delete using (public.is_admin_user());

drop policy if exists conferencia_saida_bonus_queue_items_authenticated_select on public.conferencia_saida_bonus_queue_items;
create policy conferencia_saida_bonus_queue_items_authenticated_select on public.conferencia_saida_bonus_queue_items
for select using (auth.uid() is not null);

drop policy if exists conferencia_saida_bonus_queue_items_admin_insert on public.conferencia_saida_bonus_queue_items;
create policy conferencia_saida_bonus_queue_items_admin_insert on public.conferencia_saida_bonus_queue_items
for insert with check (public.is_admin_user());

drop policy if exists conferencia_saida_bonus_queue_items_admin_update on public.conferencia_saida_bonus_queue_items;
create policy conferencia_saida_bonus_queue_items_admin_update on public.conferencia_saida_bonus_queue_items
for update using (public.is_admin_user()) with check (public.is_admin_user());

drop policy if exists conferencia_saida_bonus_queue_items_admin_delete on public.conferencia_saida_bonus_queue_items;
create policy conferencia_saida_bonus_queue_items_admin_delete on public.conferencia_saida_bonus_queue_items
for delete using (public.is_admin_user());


-- =============================================================================
-- STORAGE — bucket privado product-images + policies (path = {user_id}/...)
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', false)
on conflict (id) do nothing;

-- Escopadas pela primeira pasta do path = UID do usuário.
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


-- =============================================================================
-- VIEWS admin_* (10) — versão final
-- -----------------------------------------------------------------------------
-- Todas com security_invoker = on (fixes_v3): rodam com os privilégios de quem
-- consulta, então a RLS das tabelas-base se aplica (admin vê tudo via *_select_admin;
-- usuário comum só o seu; anônimo nada). anon perde acesso; authenticated recebe SELECT.
-- Definições finais: admin_active_users_view com janela de 150s + corte de 1h;
-- admin_dashboard_summary_view com janela de 150s; admin_avaria_items_view expondo
-- supplier + resolution_note (fixes_v2).
-- =============================================================================

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
  case
    when up.status in ('online', 'idle')
      and up.last_heartbeat_at < now() - interval '150 seconds'
    then 'offline'
    else up.status
  end as status,
  up.signed_in_at,
  up.last_heartbeat_at,
  up.signed_out_at,
  up.metadata
from public.user_presence up
left join public.profiles p on p.user_id = up.user_id
where up.status in ('online', 'idle')
  and up.last_heartbeat_at > now() - interval '1 hour'  -- some sessões mortas antigas da lista
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

-- Recriada em fixes_v2 (drop+create) para incluir supplier + resolution_note no meio.
drop view if exists public.admin_avaria_items_view;
create view public.admin_avaria_items_view as
select
  ai.user_id,
  p.name as user_name,
  p.email as user_email,
  ab.id as batch_id,
  ab.status as batch_status,
  ab.bonus_type as batch_bonus_type,
  ab.supplier as supplier,
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
  ai.resolution_note,
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
  p.email as imported_by_email,
  -- Resultado da conferência (snapshot gravado pelo app ao finalizar): porcentagem,
  -- itens conferidos e divergências. Derivado de imported_payload, sem coluna nova.
  -- Colunas APENDADAS no fim — `create or replace view` exige manter a ordem das demais.
  coalesce(cbq.imported_payload->'conference_result', '[]'::jsonb) as conference_result,
  coalesce((cbq.imported_payload->>'checked_quantity')::numeric, 0) as checked_quantity,
  coalesce((cbq.imported_payload->>'checked_items')::integer, 0) as checked_items,
  coalesce((cbq.imported_payload->>'divergence_count')::integer, 0) as divergence_count,
  (cbq.imported_payload->>'conferred_at') as conferred_at,
  coalesce((cbq.imported_payload->>'finalized_with_pendency')::boolean, false) as finalized_with_pendency
from public.conferencia_bonus_queue cbq
left join public.profiles p on p.user_id = cbq.imported_by
order by cbq.created_at desc;

-- Fila de bônus de saída para o painel admin (com resultado da conferência).
create or replace view public.admin_conferencia_saida_bonus_queue_view as
select
  sbq.id,
  sbq.source_type,
  sbq.order_code,
  sbq.order_key,
  sbq.carga_code,
  sbq.customer_name,
  sbq.customer_code,
  sbq.route_code,
  sbq.item_count,
  sbq.total_quantity,
  sbq.status,
  sbq.assigned_user_id,
  sbq.assigned_user_name,
  sbq.started_at,
  sbq.finished_at,
  sbq.created_at,
  sbq.updated_at,
  p.name as imported_by_name,
  p.email as imported_by_email,
  coalesce(sbq.imported_payload->'conference_result', '[]'::jsonb) as conference_result,
  coalesce((sbq.imported_payload->>'checked_quantity')::numeric, 0) as checked_quantity,
  coalesce((sbq.imported_payload->>'checked_items')::integer, 0) as checked_items,
  coalesce((sbq.imported_payload->>'divergence_count')::integer, 0) as divergence_count,
  (sbq.imported_payload->>'conferred_at') as conferred_at,
  coalesce((sbq.imported_payload->>'finalized_with_pendency')::boolean, false) as finalized_with_pendency
from public.conferencia_saida_bonus_queue sbq
left join public.profiles p on p.user_id = sbq.imported_by
order by sbq.created_at desc;

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

-- Agregados de uma linha; usuários ativos contam heartbeat < 150s (fixes_v2).
create or replace view public.admin_dashboard_summary_view as
select
  (select count(*) from public.user_presence up
     where up.status in ('online', 'idle')
       and up.last_heartbeat_at > now() - interval '150 seconds') as active_users,
  (select count(*) from public.recebimento_treatment_cases rtc
     where rtc.status in ('ABERTA', 'EM ANDAMENTO', 'AGUARDANDO')) as open_tratativas,
  (select count(*) from public.validade_products vp
     where coalesce(vp.status, 'active') = 'active') as active_validade_products,
  (select count(*) from public.avaria_batches ab where ab.status = 'open') as open_avaria_batches,
  (select count(*) from public.avaria_items ai where ai.status = 'damaged') as open_avaria_items,
  (select count(*) from public.conferencia_bonus_queue cbq
     where cbq.status in ('nao_iniciado', 'em_conferencia')) as open_bonus_queue,
  (select count(*) from public.conferencia_divergencias cd
     where coalesce(cd.payload ->> 'status', '') <> 'resolvida') as pending_divergencias;

-- Hardening das views (fixes_v3): security_invoker=on + revoke anon + grant authenticated.
do $$
declare
  v_name text;
  v_views text[] := array[
    'admin_active_users_view',
    'admin_tratativas_view',
    'admin_validade_products_view',
    'admin_avaria_items_view',
    'admin_conferencia_recebimentos_view',
    'admin_conferencia_saidas_view',
    'admin_conferencia_bonus_queue_view',
    'admin_conferencia_saida_bonus_queue_view',
    'admin_purchase_orders_view',
    'admin_purchase_order_actions_view',
    'admin_dashboard_summary_view'
  ];
begin
  foreach v_name in array v_views loop
    begin
      execute format('alter view public.%I set (security_invoker = on);', v_name);
      execute format('revoke all on public.%I from anon;', v_name);
      execute format('grant select on public.%I to authenticated;', v_name);
    exception
      when undefined_table then
        raise notice 'view % ausente, pulando.', v_name;
    end;
  end loop;
end$$;


-- =============================================================================
-- BOOTSTRAP
-- -----------------------------------------------------------------------------
-- Não há policy de INSERT em admin_users: promova o primeiro admin manualmente
-- (service role / SQL Editor), depois os demais via UPDATE pela aplicação:
--   insert into public.admin_users (user_id, role) values ('UUID_DO_USUARIO', 'admin');
-- =============================================================================
