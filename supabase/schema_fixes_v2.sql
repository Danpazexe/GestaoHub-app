-- =============================================
-- Gestão Hub - Correções v2 (deixar app + web "redondo")
-- =============================================
-- Rode no SQL Editor do Supabase APÓS schema_app_v1.sql e schema_admin_panel_v1.sql.
-- Idempotente: pode rodar mais de uma vez sem problema.

-- ---------------------------------------------
-- 1) Escrita do ADMIN nas tabelas operacionais
--    (o painel usa anon key + RLS; sem isto, UPDATE/DELETE do admin
--     em linhas de OUTROS usuários afeta 0 linhas silenciosamente)
-- ---------------------------------------------
drop policy if exists avaria_items_admin_update on public.avaria_items;
create policy avaria_items_admin_update on public.avaria_items
for update using (public.is_admin_user()) with check (public.is_admin_user());

drop policy if exists avaria_items_admin_delete on public.avaria_items;
create policy avaria_items_admin_delete on public.avaria_items
for delete using (public.is_admin_user());

drop policy if exists avaria_batches_admin_update on public.avaria_batches;
create policy avaria_batches_admin_update on public.avaria_batches
for update using (public.is_admin_user()) with check (public.is_admin_user());

drop policy if exists avaria_batches_admin_delete on public.avaria_batches;
create policy avaria_batches_admin_delete on public.avaria_batches
for delete using (public.is_admin_user());

drop policy if exists validade_products_admin_update on public.validade_products;
create policy validade_products_admin_update on public.validade_products
for update using (public.is_admin_user()) with check (public.is_admin_user());

drop policy if exists recebimento_treatment_cases_admin_update on public.recebimento_treatment_cases;
create policy recebimento_treatment_cases_admin_update on public.recebimento_treatment_cases
for update using (public.is_admin_user()) with check (public.is_admin_user());

-- conferencia_bonus_queue: faltava a policy de DELETE (RLS ligado mas nenhuma policy = nega p/ todos)
drop policy if exists conferencia_bonus_queue_admin_delete on public.conferencia_bonus_queue;
create policy conferencia_bonus_queue_admin_delete on public.conferencia_bonus_queue
for delete using (public.is_admin_user());

-- ---------------------------------------------
-- 2) Force sign-out (admin força logout de outro usuário) via RPC SECURITY DEFINER.
--    Retorna a quantidade de sessões encerradas (para a UI distinguir "sem sessão ativa").
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

-- ---------------------------------------------
-- 3) Avaria: coluna de fornecedor (obrigatória no app, antes era perdida no sync)
--    e nota de resolução.
-- ---------------------------------------------
alter table if exists public.avaria_batches add column if not exists supplier text;
alter table if exists public.avaria_items  add column if not exists resolution_note text;

-- ---------------------------------------------
-- 4) Presença: tratar heartbeat velho como offline.
--    Heartbeat do app = 45s → janela de frescor = 150s (~3 batidas).
--    Corrige "app fechado fica Online pra sempre" e a contagem inflada de ativos,
--    inclusive retroativamente (sem precisar de release do app).
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

-- ---------------------------------------------
-- 5) Avaria admin view: expor fornecedor + nota de resolução.
--    (drop + create porque as colunas novas entram no meio da view; o
--     CREATE OR REPLACE VIEW do Postgres só permite acrescentar no fim.)
-- ---------------------------------------------
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
