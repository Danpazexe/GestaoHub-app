-- =============================================
-- Gestão Hub - Correções v3 (segurança: vazamento entre usuários)
-- =============================================
-- Rode no SQL Editor do Supabase APÓS schema_app_v1.sql, schema_admin_panel_v1.sql
-- e schema_fixes_v2.sql.
-- Idempotente: pode rodar mais de uma vez sem problema.
-- Requer Postgres 15+ (security_invoker em views). Projetos Supabase atuais já são 15+.

-- ---------------------------------------------
-- 1) CRÍTICO: views admin_* rodavam como "security definer" (dono),
--    então NÃO aplicavam RLS e qualquer usuário autenticado (anon key do app)
--    conseguia ler dados de TODOS os usuários via, ex.:
--        select * from public.admin_validade_products_view;
--
--    Com security_invoker = on a view passa a rodar com os privilégios de quem
--    consulta, então a RLS das tabelas-base vale:
--      - admin (is_admin_user()) continua vendo tudo (policies *_select_admin);
--      - usuário comum só vê as próprias linhas (policies de dono);
--      - anônimo (sem auth.uid()) não vê nada.
--    Nenhuma view referencia auth.users, e toda tabela-base tem policy de
--    select para admin, então o painel continua funcionando igual.
-- ---------------------------------------------
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
    'admin_purchase_orders_view',
    'admin_purchase_order_actions_view',
    'admin_dashboard_summary_view'
  ];
begin
  foreach v_name in array v_views loop
    begin
      execute format('alter view public.%I set (security_invoker = on);', v_name);
      -- defesa extra: anônimo não acessa a view nem para tentar (RLS já barraria).
      execute format('revoke all on public.%I from anon;', v_name);
      execute format('grant select on public.%I to authenticated;', v_name);
    exception
      -- uma view ausente (schema parcial) não aborta o hardening das demais.
      when undefined_table then
        raise notice 'view % ausente, pulando.', v_name;
    end;
  end loop;
end$$;

-- ---------------------------------------------
-- 2) conferencia_bonus_queue: UPDATE estava aberto (using auth.uid() is not null),
--    ou seja, QUALQUER usuário autenticado podia atualizar QUALQUER linha da fila
--    (sequestrar/sobrescrever a conferência de bônus de outro operador).
--
--    A fila é um POOL COMPARTILHADO de propósito (o app lista e o operador
--    "assume" uma tarefa - ver conferenciaBonusQueueService.js), então o SELECT
--    permanece compartilhado entre operadores. O que travamos é a ESCRITA:
--    só admin, OU linha ainda não atribuída (assumir), OU a própria atribuição.
--    Isso preserva claim / progresso / finalizar do app e impede mexer na
--    tarefa de outro operador.
-- ---------------------------------------------
-- Mesmo nome canônico do schema base (já corrigido), para não divergir nem
-- recriar policy permissiva ao reaplicar o schema em qualquer ordem.
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

-- ---------------------------------------------
-- 3) recebimento_treatment_cases.supplier_code: era NOT NULL no CREATE TABLE,
--    mas o mapper do app envia null quando vazio (tratativaCaseMapper.js) e
--    casos de espelho/recebimento podem não ter código de fornecedor. Resultado:
--    o backfill quebrava com "null value in column supplier_code violates
--    not-null constraint" e as tratativas nunca sincronizavam.
--    Tornar nullable alinha schema + mapper + dados (corrige sem release do app).
-- ---------------------------------------------
alter table if exists public.recebimento_treatment_cases
  alter column supplier_code drop not null;
