-- =============================================
-- Gestão Hub - Correções v4 (integridade: CHECKs de domínio + índices faltantes)
-- =============================================
-- Rode no SQL Editor do Supabase APÓS schema_app_v1.sql, schema_admin_panel_v1.sql,
-- schema_fixes_v2.sql e schema_fixes_v3.sql.
-- Idempotente: pode rodar mais de uma vez sem problema (drop ... if exists antes de
-- add; create index if not exists).
--
-- OBJETIVO
--   As colunas de "status/tipo" são text livre. Este arquivo adiciona CHECKs que
--   travam o CONJUNTO de valores aceitos a partir de AGORA, sem reescrever nem
--   recusar nada do que já está gravado.
--
-- POR QUE "NOT VALID" (LEIA ANTES DE VALIDAR)
--   `add constraint ... check (...) not valid` registra o CHECK e o aplica a TODA
--   escrita nova (INSERT/UPDATE), mas NÃO varre as linhas já existentes. Isso evita
--   que o ALTER quebre num banco de produção que possa conter algum valor legado
--   fora do conjunto. Os conjuntos abaixo já incluem os legados CONHECIDOS (ver
--   notas em cada bloco), então na prática o app não é bloqueado.
--   Depois de auditar/limpar os dados, dá para promover cada constraint com:
--       alter table public.<tabela> validate constraint <nome>;
--   (VALIDATE pega lock fraco - SHARE UPDATE EXCLUSIVE - e só falha se houver
--    linha fora do conjunto; é seguro rodar fora de horário de pico.)
--
-- FONTE DE CADA CONJUNTO
--   Os valores NÃO foram inventados: vêm das CONSTANTES do app + dos mappers/services
--   que efetivamente gravam, e dos comentários "-- a | b | c" do schema base. As
--   referências de arquivo estão em cada bloco.

-- ---------------------------------------------
-- 1) recebimento_treatment_cases
--    status:          src/.../recebimentoTratativa/constants/tratativaOptions.js (TRATATIVA_STATUS / STATUS_OPTIONS)
--    occurrence_type: idem (OCCURRENCE_OPTIONS) -> avaria | falta | outro
--    resolution_type: idem (ACTION_OPTIONS)     -> devolucao | troca | tratativa | descarte
--      + LEGADO: tratativaCaseMapper.js mapeia, na leitura, valores antigos
--        recolhimento->devolucao, reposicao->troca, abatimento->tratativa.
--        Linhas antigas podem ter os códigos legados gravados; ficam incluídos
--        para o CHECK não recusar um UPDATE que reescreva essa mesma linha.
-- ---------------------------------------------
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
    -- legados (tratativaCaseMapper.js):
    'recolhimento','reposicao','abatimento'
  ))
  not valid;

-- ---------------------------------------------
-- 2) validade_products
--    status:         comentário do schema (active | treated | resolved); gravado por
--                    validadeSupabaseService.js e ListScreen.js ('treated').
--      + LEGADO: 'resolvida' — o web ANTES gravava 'resolvida' aqui (ver comentário
--        em GestaoHub-web/src/services/adminApi.js resolveValidadeItem, hoje 'resolved').
--        Incluído para não recusar UPDATE de linhas antigas.
--    treatment_type: TratarScreen.js TREATMENT_TYPES (sold | exchanged | returned | expired)
--                    + 'unknown' (default usado em TratarScreen/DashboardScreen).
--      treatment_type é nullable (NULL = produto ainda não tratado); o CHECK só
--      restringe quando NÃO é nulo.
-- ---------------------------------------------
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

-- ---------------------------------------------
-- 3) avaria_batches
--    status:     comentário do schema + avariaSupabaseService.js/avariaBatchService.js
--                -> open | concluded
--    bonus_type: avaria/constants/index.js BONUS_TYPES -> merchandise | money | exchange
--                (nullable: lote pode não ter bônus definido)
-- ---------------------------------------------
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

-- ---------------------------------------------
-- 4) avaria_items
--    status:          comentário do schema + avariaSupabaseService.js -> damaged | resolved
--    damage_type:     avaria/constants/index.js DAMAGE_TYPES
--                     -> broken | leaking | expired | spoiled | missing | other
--    resolution_type: avaria/constants/index.js RESOLUTION_TYPES
--                     -> discard | supplier_return | donation | discount_sale | stock_return
--    bonus_type:      denormalizado do lote (mesmo conjunto de avaria_batches)
--    Todos os *_type são nullable (item pode não ter sido classificado/resolvido).
-- ---------------------------------------------
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

-- ---------------------------------------------
-- 5) conferencia_bonus_queue
--    status:      comentário do schema + conferenciaBonusQueueService.js
--                 -> nao_iniciado | em_conferencia | finalizada | cancelada
--    source_type: schema diz xml_nf | manual; mas adminApi.js também grava
--                 'purchase_order' e 'recebimento' (importConferenciaBonusFrom*).
--                 Conjunto inclusivo para não bloquear esses fluxos.
-- ---------------------------------------------
alter table if exists public.conferencia_bonus_queue
  drop constraint if exists ck_bonus_queue_status;
alter table if exists public.conferencia_bonus_queue
  add constraint ck_bonus_queue_status
  check (status in ('nao_iniciado','em_conferencia','finalizada','cancelada'))
  not valid;

alter table if exists public.conferencia_bonus_queue
  drop constraint if exists ck_bonus_queue_source_type;
alter table if exists public.conferencia_bonus_queue
  add constraint ck_bonus_queue_source_type
  check (source_type in ('xml_nf','manual','purchase_order','recebimento'))
  not valid;

-- ---------------------------------------------
-- 6) purchase_orders (todos os "status*" do comentário do schema base,
--    confirmados pelos UPDATEs em GestaoHub-web/src/services/adminApi.js)
--    status:        pedido_criado | entrada_pendente | entrada_realizada | bonus_gerado
--                   | devolucao_pendente | devolucao_emitida | auditado | encerrado | cancelado
--    entry_status:  pendente | parcial | realizada
--    bonus_status:  nao_gerado | gerado
--    return_status: sem_devolucao | pendente | emitida
--    audit_status:  pendente | revisado | aprovado
--    source_type:   schema diz xml_nf | manual | avulso; adminApi também usa
--                   'purchase_order' como origem de bônus — incluído por segurança.
-- ---------------------------------------------
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

-- ---------------------------------------------
-- 7) purchase_order_actions.action_type
--    comentário do schema + os actionType gravados por adminApi.js:
--    pedido_criado | entrada_realizada | bonus_gerado | devolucao_pendente
--    | devolucao_emitida | reimpressao | auditoria
-- ---------------------------------------------
alter table if exists public.purchase_order_actions
  drop constraint if exists ck_poa_action_type;
alter table if exists public.purchase_order_actions
  add constraint ck_poa_action_type
  check (action_type in (
    'pedido_criado','entrada_realizada','bonus_gerado',
    'devolucao_pendente','devolucao_emitida','reimpressao','auditoria'
  ))
  not valid;

-- ---------------------------------------------
-- 8) admin_users.role
--    comentário do schema -> admin | supervisor | auditor
-- ---------------------------------------------
alter table if exists public.admin_users
  drop constraint if exists ck_admin_users_role;
alter table if exists public.admin_users
  add constraint ck_admin_users_role
  check (role in ('admin','supervisor','auditor'))
  not valid;

-- ---------------------------------------------
-- 9) user_presence.status
--    comentário do schema + presenceService.js ('online','signed_out') e o web
--    (UsersView.jsx) que distingue online | idle | offline | signed_out.
-- ---------------------------------------------
alter table if exists public.user_presence
  drop constraint if exists ck_user_presence_status;
alter table if exists public.user_presence
  add constraint ck_user_presence_status
  check (status in ('online','idle','offline','signed_out'))
  not valid;

-- ---------------------------------------------
-- 10) Índices faltantes para filtros/ordenações comuns
--     (create index if not exists = idempotente; sem CONCURRENTLY de propósito,
--      pois migration simples roda em transação e estas tabelas são pequenas).
-- ---------------------------------------------
-- avaria_items.status: o dashboard conta itens 'damaged' (admin_dashboard_summary_view)
create index if not exists idx_avaria_items_status
  on public.avaria_items(user_id, status);

-- avaria_batches.status: idem (open_avaria_batches)
create index if not exists idx_avaria_batches_status
  on public.avaria_batches(user_id, status);

-- validade_products.treatment_type: relatórios de tratativa agrupam por tipo
create index if not exists idx_validade_products_treatment_type
  on public.validade_products(user_id, treatment_type);

-- purchase_orders.created_by + created_at: listagem do painel ordena por data
create index if not exists idx_purchase_orders_created_by_created_at
  on public.purchase_orders(created_by, created_at desc);

-- purchase_order_items.created_by: RLS/owner filtra por este campo
create index if not exists idx_purchase_order_items_created_by
  on public.purchase_order_items(created_by);

-- conferencia_bonus_queue.assigned_user_id: a UI lista "minhas tarefas" e a RLS
-- de update compara por assigned_user_id (schema_fixes_v3.sql)
create index if not exists idx_conferencia_bonus_queue_assigned_user
  on public.conferencia_bonus_queue(assigned_user_id);

-- conferencia_bonus_queue.invoice_number já tem índice no schema base; aqui só
-- garante presença caso o base não tenha rodado (idempotente).
create index if not exists idx_conferencia_bonus_queue_invoice
  on public.conferencia_bonus_queue(invoice_number);

-- operational_events.session_id: junção/limpeza por sessão de presença
create index if not exists idx_operational_events_session
  on public.operational_events(session_id);

-- ---------------------------------------------
-- 11) NOTA sobre FKs faltantes (intencionalmente NÃO adicionadas)
--     - operational_events.session_id já referencia user_presence(session_id) no
--       schema base (on delete set null).
--     - conferencia_recebimentos/saidas guardam um source_recebimento_id DENTRO do
--       jsonb payload, não como coluna -> não há FK possível/segura.
--     - purchase_order_items/actions já têm FK para purchase_orders no schema base.
--     Nenhuma FK nova é claramente segura aqui sem risco de quebrar dados de espelho
--     local-first, então deixamos só CHECK + índices.
