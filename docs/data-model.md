# Modelo de Dados — GestãoHub

> Documento gerado a partir dos schemas SQL canônicos do Supabase:
> `supabase/schema_app_v1.sql`, `supabase/schema_admin_panel_v1.sql`,
> `supabase/schema_fixes_v2.sql`, `supabase/schema_fixes_v3.sql`.
>
> Toda persistência fica no schema `public`. Autenticação usa `auth.users` (Supabase Auth).
> Imagens ficam no bucket privado de Storage `product-images`.
>
> Convenção: este documento descreve o **estado consolidado** após aplicar os 4 arquivos na
> ordem (`app_v1` → `admin_panel_v1` → `fixes_v2` → `fixes_v3`). Quando um fix altera algo do
> schema base, o comportamento descrito aqui é o do estado final.

---

## Índice

- [Visão geral por domínio](#visão-geral-por-domínio)
- [Diagrama ERD (Mermaid)](#diagrama-erd-mermaid)
- [Domínio 1 — Auth / Perfil](#domínio-1--auth--perfil)
- [Domínio 2 — Presença / Auditoria](#domínio-2--presença--auditoria)
- [Domínio 3 — Validade](#domínio-3--validade)
- [Domínio 4 — Avaria](#domínio-4--avaria)
- [Domínio 5 — Conferência](#domínio-5--conferência)
- [Domínio 6 — Recebimento / Tratativas](#domínio-6--recebimento--tratativas)
- [Domínio 7 — Compras / Purchase Orders](#domínio-7--compras--purchase-orders)
- [Domínio 8 — Admin (papéis, fila de bônus, views)](#domínio-8--admin-papéis-fila-de-bônus-views)
- [Funções e triggers](#funções-e-triggers)
- [Storage](#storage)
- [Views `admin_*`](#views-admin_)
- [Resumo de RLS por tabela](#resumo-de-rls-por-tabela)
- [Inconsistências observadas](#inconsistências-observadas)

---

## Visão geral por domínio

| Domínio | Tabelas | Dono dos dados |
|---|---|---|
| Auth / Perfil | `profiles`, `user_settings` | usuário (`user_id`) |
| Presença / Auditoria | `user_presence`, `operational_events` | usuário; leitura admin |
| Validade | `validade_products` | usuário (`user_id`) |
| Avaria | `avaria_batches`, `avaria_items` | usuário (`user_id`) |
| Conferência | `conferencia_recebimentos`, `conferencia_saidas`, `conferencia_divergencias` | usuário (`user_id`) |
| Recebimento / Tratativas | `recebimento_treatment_cases` | usuário (`user_id`) |
| Compras / Purchase Orders | `purchase_orders`, `purchase_order_items`, `purchase_order_actions` | `created_by` (admin) |
| Admin | `admin_users`, `conferencia_bonus_queue`, `conferencia_bonus_queue_items` + 10 views `admin_*` | admin / pool compartilhado |

**Modelo de propriedade.** Quase todas as tabelas operacionais são *owner-scoped*: a coluna
`user_id` (ou `created_by`) aponta para `auth.users`, e a RLS permite ao dono ler/escrever apenas
as próprias linhas. O admin (linha em `admin_users`) tem `SELECT` em tudo e `UPDATE`/`DELETE`
seletivos via a função `public.is_admin_user()`.

**Chave composta local.** Tabelas que sincronizam IDs gerados no app usam PK composta
`(user_id, id)` com `id text` — o ID vem do cliente, então só precisa ser único por usuário.
Tabelas geradas no servidor usam PK `id uuid default gen_random_uuid()`.

---

## Diagrama ERD (Mermaid)

```mermaid
erDiagram
    auth_users ||--|| profiles : "user_id"
    auth_users ||--|| user_settings : "user_id"
    auth_users ||--o{ validade_products : "user_id"
    auth_users ||--o{ recebimento_treatment_cases : "user_id"
    auth_users ||--o{ avaria_batches : "user_id"
    auth_users ||--o{ avaria_items : "user_id"
    auth_users ||--o{ conferencia_recebimentos : "user_id"
    auth_users ||--o{ conferencia_saidas : "user_id"
    auth_users ||--o{ conferencia_divergencias : "user_id"
    auth_users ||--o{ purchase_orders : "created_by"
    auth_users ||--o{ purchase_order_items : "created_by"
    auth_users ||--o{ purchase_order_actions : "created_by"
    auth_users ||--o| admin_users : "user_id"
    auth_users ||--o{ user_presence : "user_id"
    auth_users ||--o{ operational_events : "user_id"
    auth_users ||--o{ conferencia_bonus_queue : "imported_by/assigned"

    avaria_batches ||--o{ avaria_items : "(user_id, batch_id)"
    user_presence ||--o{ operational_events : "session_id"
    purchase_orders ||--o{ purchase_order_items : "order_id"
    purchase_orders ||--o{ purchase_order_actions : "order_id"
    conferencia_bonus_queue ||--o{ conferencia_bonus_queue_items : "queue_id"

    profiles {
        uuid user_id PK_FK
        text name
        text email
        text avatar_url
        timestamptz created_at
        timestamptz updated_at
    }
    user_settings {
        uuid user_id PK_FK
        boolean dark_mode
        boolean biometric_enabled
        boolean auto_backup
        boolean notification_enabled
        jsonb extra
    }
    validade_products {
        text id PK
        uuid user_id PK_FK
        text codprod
        text descricao
        text codauxiliar
        text lote
        timestamptz validade
        integer quantidade
        integer diasrestantes
        text image_path
        jsonb location
        text status
        text treatment_type
        integer treatment_quantity
        timestamptz treatment_date
    }
    recebimento_treatment_cases {
        text id PK
        uuid user_id PK_FK
        text doc_number
        text supplier_code
        integer doc_sequence_number
        text origin_invoice_number
        text return_invoice_number
        text status
        text occurrence_type
        text resolution_type
        integer affected_quantity
        integer expected_quantity
        integer received_quantity
        jsonb product_snapshot
        text_array reasons
        text_array handling_methods
    }
    avaria_batches {
        text id PK
        uuid user_id PK_FK
        text supplier
        text bonus_type
        text notes
        text status
    }
    avaria_items {
        text id PK
        uuid user_id PK_FK
        text batch_id FK
        text descricao
        text codprod
        integer quantidade
        text lote
        text damage_type
        text resolution_type
        text resolution_note
        text bonus_type
        text status
    }
    conferencia_recebimentos {
        text id PK
        uuid user_id PK_FK
        jsonb payload
    }
    conferencia_saidas {
        text id PK
        uuid user_id PK_FK
        jsonb payload
    }
    conferencia_divergencias {
        text id PK
        uuid user_id PK_FK
        jsonb payload
    }
    purchase_orders {
        uuid id PK
        uuid created_by FK
        text order_number UK
        text source_type
        text supplier_name
        text invoice_number
        text status
        text entry_status
        text bonus_status
        text return_status
        text audit_status
        numeric total_quantity
        jsonb xml_payload
    }
    purchase_order_items {
        uuid id PK
        uuid order_id FK
        uuid created_by FK
        text description
        numeric expected_qty
        numeric received_qty
        numeric divergence_qty
        jsonb packaging_options
    }
    purchase_order_actions {
        uuid id PK
        uuid order_id FK
        uuid created_by FK
        text action_type
        text action_label
        jsonb payload
    }
    admin_users {
        uuid user_id PK_FK
        text role
    }
    user_presence {
        uuid session_id PK
        uuid user_id FK
        text device_label
        text platform
        text status
        timestamptz last_heartbeat_at
        jsonb metadata
    }
    operational_events {
        uuid id PK
        uuid user_id FK
        uuid session_id FK
        text module
        text event_type
        text entity_type
        text entity_id
        jsonb payload
    }
    conferencia_bonus_queue {
        uuid id PK
        text source_type
        text invoice_number
        text supplier_name
        text status
        uuid imported_by FK
        uuid assigned_user_id FK
        jsonb imported_payload
    }
    conferencia_bonus_queue_items {
        uuid id PK
        uuid queue_id FK
        text description
        numeric expected_qty
    }
```

> Nota: o Mermaid não permite o tipo `text[]`; ele aparece como `text_array` no diagrama,
> mas o tipo real no banco é `text[]`.

---

## Domínio 1 — Auth / Perfil

### `profiles`
Perfil do usuário, populado automaticamente a partir de `auth.users` via trigger.

| Coluna | Tipo | Null | Default | Observações |
|---|---|---|---|---|
| `user_id` | uuid | não | — | **PK**; FK → `auth.users(id)` `ON DELETE CASCADE` |
| `name` | text | sim | — | Default na criação: `raw_user_meta_data->>'name'` ou parte antes do `@` do e-mail |
| `email` | text | sim | — | Copiado de `auth.users.email` |
| `avatar_url` | text | sim | — | |
| `created_at` | timestamptz | não | `now()` | |
| `updated_at` | timestamptz | não | `now()` | Atualizado por trigger `set_updated_at` |

- **PK:** `user_id`
- **FKs:** `user_id` → `auth.users(id)`
- **Triggers:** `trg_profiles_updated_at` (BEFORE UPDATE); `on_auth_user_created_profile` (AFTER INSERT em `auth.users`, popula/upsert o perfil).
- **RLS:** dono lê/insere/atualiza o próprio perfil (`profiles_select_own`, `profiles_insert_own`, `profiles_update_own`); admin tem `SELECT` (`profiles_select_admin`). Sem policy de `DELETE` (cascade via `auth.users`).

### `user_settings`
Preferências por usuário (1:1 com o usuário).

| Coluna | Tipo | Null | Default | Observações |
|---|---|---|---|---|
| `user_id` | uuid | não | — | **PK**; FK → `auth.users(id)` `ON DELETE CASCADE` |
| `dark_mode` | boolean | não | `false` | |
| `biometric_enabled` | boolean | não | `false` | |
| `auto_backup` | boolean | não | `false` | |
| `notification_enabled` | boolean | não | `true` | |
| `extra` | jsonb | não | `'{}'` | Bag de configurações livres (ex.: `logisticsLocationConfig`) |
| `created_at` | timestamptz | não | `now()` | |
| `updated_at` | timestamptz | não | `now()` | Trigger `set_updated_at` |

- **PK:** `user_id` · **FKs:** `user_id` → `auth.users(id)`
- **Triggers:** `trg_user_settings_updated_at`
- **RLS:** dono lê (`settings_select_own`) e tem `ALL` (`settings_upsert_own`); admin tem `SELECT` (`user_settings_select_admin`).

---

## Domínio 2 — Presença / Auditoria

### `user_presence`
Sessão ativa do app (heartbeat). Uma linha por sessão.

| Coluna | Tipo | Null | Default | Observações |
|---|---|---|---|---|
| `session_id` | uuid | não | `gen_random_uuid()` | **PK** |
| `user_id` | uuid | não | — | FK → `auth.users(id)` `ON DELETE CASCADE` |
| `device_label` | text | sim | — | |
| `platform` | text | sim | — | |
| `app_version` | text | sim | — | |
| `current_module` | text | sim | — | Módulo onde o usuário está |
| `current_screen` | text | sim | — | |
| `current_order_ref` | text | sim | — | |
| `current_batch_ref` | text | sim | — | |
| `status` | text | não | `'online'` | `online \| idle \| offline \| signed_out` |
| `signed_in_at` | timestamptz | não | `now()` | |
| `last_heartbeat_at` | timestamptz | não | `now()` | Heartbeat do app a cada ~45s; frescor = 150s |
| `signed_out_at` | timestamptz | sim | — | Preenchido por logout / force sign-out |
| `metadata` | jsonb | não | `'{}'` | |
| `created_at` | timestamptz | não | `now()` | |
| `updated_at` | timestamptz | não | `now()` | Trigger `set_updated_at` |

- **PK:** `session_id` · **FKs:** `user_id` → `auth.users(id)`
- **Índices:** `idx_user_presence_user(user_id)`, `idx_user_presence_status(status)`, `idx_user_presence_heartbeat(last_heartbeat_at desc)`
- **Triggers:** `trg_user_presence_updated_at`
- **RLS:** dono tem `ALL` (`user_presence_owner_all`); admin tem `SELECT` (`user_presence_admin_select`). Logout forçado via RPC `admin_force_sign_out(uuid)` (SECURITY DEFINER).

### `operational_events`
Log append-only de eventos operacionais (auditoria).

| Coluna | Tipo | Null | Default | Observações |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | **PK** |
| `user_id` | uuid | sim | — | FK → `auth.users(id)` `ON DELETE SET NULL` |
| `session_id` | uuid | sim | — | FK → `user_presence(session_id)` `ON DELETE SET NULL` |
| `module` | text | não | — | |
| `event_type` | text | não | — | |
| `entity_type` | text | sim | — | |
| `entity_id` | text | sim | — | |
| `order_ref` | text | sim | — | |
| `batch_ref` | text | sim | — | |
| `actor_name` | text | sim | — | |
| `payload` | jsonb | não | `'{}'` | |
| `created_at` | timestamptz | não | `now()` | |

- **PK:** `id` · **FKs:** `user_id` → `auth.users(id)`; `session_id` → `user_presence(session_id)`
- **Índices:** `idx_operational_events_user(user_id)`, `idx_operational_events_module(module)`, `idx_operational_events_entity(entity_type, entity_id)`, `idx_operational_events_created_at(created_at desc)`
- **Triggers:** nenhum (sem `updated_at`; tabela append-only)
- **RLS:** dono insere (`operational_events_owner_insert`) e lê o próprio (`operational_events_owner_select`); admin tem `SELECT` (`operational_events_admin_select`). Sem `UPDATE`/`DELETE`.

---

## Domínio 3 — Validade

### `validade_products`
Backend da lista de validade — inclui produtos ativos e tratados.

| Coluna | Tipo | Null | Default | Observações |
|---|---|---|---|---|
| `id` | text | não | — | ID gerado no app; parte da **PK** |
| `user_id` | uuid | não | — | FK → `auth.users(id)` `ON DELETE CASCADE`; parte da **PK** |
| `codprod` | text | sim | — | Código do produto |
| `descricao` | text | não | — | |
| `codauxiliar` | text | sim | — | EAN/código auxiliar |
| `lote` | text | sim | — | |
| `validade` | timestamptz | sim | — | Data de validade |
| `quantidade` | integer | não | `0` | |
| `diasrestantes` | integer | sim | — | Calculado pelo app |
| `image_path` | text | sim | — | Caminho no bucket `product-images` |
| `location` | jsonb | não | `'{}'` | Localização logística: `corredor`, `prateleira`, `nivel`, `aereo`, `picking`, `gondola`, `observacao` |
| `status` | text | não | `'active'` | `active \| treated \| resolved` |
| `treatment_type` | text | sim | — | `sold \| exchanged \| returned \| expired \| unknown` |
| `treatment_quantity` | integer | sim | — | |
| `treatment_date` | timestamptz | sim | — | |
| `treatment_note` | text | sim | — | |
| `created_at` | timestamptz | não | `now()` | |
| `updated_at` | timestamptz | não | `now()` | Trigger `set_updated_at` |

- **PK:** `(user_id, id)` · **FKs:** `user_id` → `auth.users(id)`
- **Índices:** `idx_validade_products_user(user_id)`, `idx_validade_products_codprod(user_id, codprod)`, `idx_validade_products_codauxiliar(user_id, codauxiliar)`, `idx_validade_products_status(user_id, status)`
- **Triggers:** `trg_validade_products_updated_at`
- **RLS:** dono tem `ALL` (`validade_products_owner_all`); admin tem `SELECT` (`validade_products_select_admin`) e `UPDATE` (`validade_products_admin_update`, em fixes_v2). Sem `DELETE` admin.

---

## Domínio 4 — Avaria

### `avaria_batches`
Lote de avaria/bônus.

| Coluna | Tipo | Null | Default | Observações |
|---|---|---|---|---|
| `id` | text | não | — | parte da **PK** |
| `user_id` | uuid | não | — | FK → `auth.users(id)` `ON DELETE CASCADE`; parte da **PK** |
| `supplier` | text | sim | — | Fornecedor (adicionada em fixes_v2; antes era perdida no sync) |
| `bonus_type` | text | sim | — | |
| `notes` | text | sim | — | |
| `status` | text | não | `'open'` | `open \| concluded` |
| `created_at` | timestamptz | não | `now()` | |
| `updated_at` | timestamptz | não | `now()` | Trigger `set_updated_at` |

- **PK:** `(user_id, id)` · **FKs:** `user_id` → `auth.users(id)`
- **Índices:** `idx_avaria_batches_user(user_id)`
- **Triggers:** `trg_avaria_batches_updated_at`
- **RLS:** dono tem `ALL` (`avaria_batches_owner_all`); admin tem `SELECT` (`avaria_batches_select_admin`), `UPDATE` (`avaria_batches_admin_update`) e `DELETE` (`avaria_batches_admin_delete`) — ambos em fixes_v2.

### `avaria_items`
Item dentro de um lote de avaria.

| Coluna | Tipo | Null | Default | Observações |
|---|---|---|---|---|
| `id` | text | não | — | parte da **PK** |
| `batch_id` | text | não | — | parte da FK composta para o lote |
| `user_id` | uuid | não | — | FK → `auth.users(id)` `ON DELETE CASCADE`; parte da **PK** |
| `descricao` | text | não | — | |
| `codprod` | text | sim | — | |
| `quantidade` | integer | não | `0` | |
| `lote` | text | sim | — | |
| `damage_type` | text | sim | — | Tipo de dano |
| `resolution_type` | text | sim | — | |
| `resolution_note` | text | sim | — | Adicionada em fixes_v2 |
| `bonus_type` | text | sim | — | |
| `status` | text | não | `'damaged'` | `damaged \| resolved` |
| `created_at` | timestamptz | não | `now()` | |
| `updated_at` | timestamptz | não | `now()` | Trigger `set_updated_at` |

- **PK:** `(user_id, id)`
- **FKs:** `user_id` → `auth.users(id)`; `(user_id, batch_id)` → `avaria_batches(user_id, id)` `ON DELETE CASCADE`
- **Índices:** `idx_avaria_items_user(user_id)`, `idx_avaria_items_batch(batch_id)`
- **Triggers:** `trg_avaria_items_updated_at`
- **RLS:** dono tem `ALL` (`avaria_items_owner_all`); admin tem `SELECT` (`avaria_items_select_admin`), `UPDATE` (`avaria_items_admin_update`) e `DELETE` (`avaria_items_admin_delete`) — em fixes_v2.

---

## Domínio 5 — Conferência

Três tabelas estruturalmente idênticas (mesmas colunas), diferenciadas pelo conteúdo do `payload`.
São coleções históricas/operacionais; o conteúdo de negócio mora no JSON.

### `conferencia_recebimentos` / `conferencia_saidas` / `conferencia_divergencias`

| Coluna | Tipo | Null | Default | Observações |
|---|---|---|---|---|
| `id` | text | não | — | parte da **PK** |
| `user_id` | uuid | não | — | FK → `auth.users(id)` `ON DELETE CASCADE`; parte da **PK** |
| `payload` | jsonb | não | `'{}'` | Documento completo da conferência (ver views para chaves usadas) |
| `created_at` | timestamptz | não | `now()` | |
| `updated_at` | timestamptz | não | `now()` | Trigger `set_updated_at` |

- **PK:** `(user_id, id)` (cada tabela) · **FKs:** `user_id` → `auth.users(id)`
- **Índices:** `idx_conferencia_recebimentos_user(user_id)`, `idx_conferencia_saidas_user(user_id)`, `idx_conferencia_divergencias_user(user_id)`
- **Triggers:** `trg_conferencia_recebimentos_updated_at`, `trg_conferencia_saidas_updated_at`, `trg_conferencia_divergencias_updated_at`
- **RLS:** dono tem `ALL` (`*_owner_all`); admin tem `SELECT` (`*_select_admin`). Sem `UPDATE`/`DELETE` admin.

**Chaves de `payload` consumidas pelas views admin:**
- Recebimentos: `type`, `supplier`, `invoice`, `conferente`, `sync_status`, `items[]`, `totals.divergences`.
- Saídas: `type`, `orderCode`, `separador`, `embalador`, `sync_status`, `items[]`, `totals.divergences`.
- Divergências: `status` (`resolvida` indica resolvido — usado no dashboard).

---

## Domínio 6 — Recebimento / Tratativas

### `recebimento_treatment_cases`
Entidade oficial do espelho de ocorrência de recebimento (avaria/falta/etc.).

| Coluna | Tipo | Null | Default | Observações |
|---|---|---|---|---|
| `id` | text | não | — | parte da **PK** |
| `user_id` | uuid | não | — | FK → `auth.users(id)` `ON DELETE CASCADE`; parte da **PK** |
| `doc_number` | text | não | — | Padrão `TR {supplier_code} - {NNNN}` |
| `supplier_code` | text | **sim** | — | **NOT NULL no app_v1; tornado nullable em fixes_v3** (casos de espelho sem código) |
| `doc_sequence_number` | integer | sim | — | |
| `origin_invoice_number` | text | sim | — | |
| `return_invoice_number` | text | sim | — | |
| `status` | text | não | `'ABERTA'` | `ABERTA \| EM ANDAMENTO \| AGUARDANDO \| ENCERRADA \| CANCELADA` |
| `status_updated_at` | timestamptz | não | `now()` | |
| `occurrence_type` | text | não | `'avaria'` | `avaria \| falta \| outro` |
| `resolution_type` | text | não | `'devolucao'` | `devolucao \| troca \| tratativa \| descarte` |
| `affected_quantity` | integer | não | `0` | |
| `expected_quantity` | integer | não | `0` | |
| `received_quantity` | integer | não | `0` | |
| `product_snapshot` | jsonb | não | `'{}'` | Snapshot: `codprod`, `codauxiliar`, `descricao`, `fornecedor`, `lote`, `validade`, `quantidade_original`, `imageUrl`, `imagePath` |
| `opened_at` | timestamptz | não | `now()` | |
| `started_at` | timestamptz | sim | — | |
| `expected_end_at` | timestamptz | sim | — | |
| `closed_at` | timestamptz | sim | — | |
| `reasons` | text[] | não | `'{}'` | Fonte de verdade da UI |
| `handling_methods` | text[] | não | `'{}'` | |
| `reason` | text | sim | — | Derivado textual legado (compat) |
| `handling_method` | text | sim | — | Derivado textual legado (compat) |
| `observation` | text | sim | — | |
| `authorized_by` | text | sim | — | |
| `collected_by` | text | sim | — | |
| `created_at` | timestamptz | não | `now()` | |
| `updated_at` | timestamptz | não | `now()` | Trigger `set_updated_at` |

- **PK:** `(user_id, id)` · **FKs:** `user_id` → `auth.users(id)`
- **Índices:** `idx_recebimento_treatment_cases_user(user_id)`, `idx_recebimento_treatment_cases_status(user_id, status)`, `idx_recebimento_treatment_cases_origin_invoice(user_id, origin_invoice_number)`, `idx_recebimento_treatment_cases_supplier_code(user_id, supplier_code)`
- **Triggers:** `trg_recebimento_treatment_cases_updated_at`
- **RLS:** dono tem `ALL` (`recebimento_treatment_cases_owner_all`); admin tem `SELECT` (`recebimento_treatment_cases_select_admin`) e `UPDATE` (`recebimento_treatment_cases_admin_update`, fixes_v2).

---

## Domínio 7 — Compras / Purchase Orders

### `purchase_orders`
Pedido de compra / recebimento (criado pelo admin a partir de XML de NF, manual ou avulso).

| Coluna | Tipo | Null | Default | Observações |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | **PK** |
| `created_by` | uuid | não | — | FK → `auth.users(id)` `ON DELETE CASCADE` |
| `order_number` | text | não | — | **UNIQUE** |
| `source_type` | text | não | `'xml_nf'` | `xml_nf \| manual \| avulso` |
| `supplier_name` | text | não | — | |
| `supplier_code` | text | sim | — | |
| `supplier_document` | text | sim | — | |
| `invoice_number` | text | sim | — | |
| `invoice_key` | text | sim | — | |
| `issued_at` | timestamptz | sim | — | |
| `status` | text | não | `'pedido_criado'` | `pedido_criado \| entrada_pendente \| entrada_realizada \| bonus_gerado \| devolucao_pendente \| devolucao_emitida \| auditado \| encerrado \| cancelado` |
| `entry_status` | text | não | `'pendente'` | `pendente \| parcial \| realizada` |
| `bonus_status` | text | não | `'nao_gerado'` | `nao_gerado \| gerado` |
| `return_status` | text | não | `'sem_devolucao'` | `sem_devolucao \| pendente \| emitida` |
| `audit_status` | text | não | `'pendente'` | `pendente \| revisado \| aprovado` |
| `item_count` | integer | não | `0` | |
| `total_quantity` | numeric(14,3) | não | `0` | |
| `reprint_count` | integer | não | `0` | |
| `last_reprint_at` | timestamptz | sim | — | |
| `entry_at` | timestamptz | sim | — | |
| `bonus_generated_at` | timestamptz | sim | — | |
| `return_requested_at` | timestamptz | sim | — | |
| `return_completed_at` | timestamptz | sim | — | |
| `audited_at` | timestamptz | sim | — | |
| `closed_at` | timestamptz | sim | — | |
| `xml_payload` | jsonb | não | `'{}'` | XML/NF original parseado |
| `extra` | jsonb | não | `'{}'` | |
| `created_at` | timestamptz | não | `now()` | |
| `updated_at` | timestamptz | não | `now()` | Trigger `set_updated_at` |

- **PK:** `id` · **UK:** `order_number` · **FKs:** `created_by` → `auth.users(id)`
- **Índices:** `idx_purchase_orders_created_by(created_by)`, `idx_purchase_orders_status(status)`, `idx_purchase_orders_invoice_number(invoice_number)`, `idx_purchase_orders_created_at(created_at desc)`
- **Triggers:** `trg_purchase_orders_updated_at`
- **RLS:** dono (`created_by`) tem `ALL` (`purchase_orders_owner_all`); admin tem `SELECT`/`INSERT`/`UPDATE` (`purchase_orders_admin_*` + `purchase_orders_select_admin`). Sem `DELETE` admin.

### `purchase_order_items`
Linha de item do pedido.

| Coluna | Tipo | Null | Default | Observações |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | **PK** |
| `order_id` | uuid | não | — | FK → `purchase_orders(id)` `ON DELETE CASCADE` |
| `created_by` | uuid | não | — | FK → `auth.users(id)` `ON DELETE CASCADE` |
| `line_number` | integer | sim | — | |
| `code` | text | sim | — | |
| `ean` | text | sim | — | |
| `dun` | text | sim | — | |
| `description` | text | não | — | |
| `unit` | text | sim | — | |
| `expected_qty` | numeric(14,3) | não | `0` | |
| `received_qty` | numeric(14,3) | não | `0` | |
| `divergence_qty` | numeric(14,3) | não | `0` | |
| `packaging_options` | jsonb | não | `'[]'` | Array de opções de embalagem |
| `created_at` | timestamptz | não | `now()` | |
| `updated_at` | timestamptz | não | `now()` | Trigger `set_updated_at` |

- **PK:** `id` · **FKs:** `order_id` → `purchase_orders(id)`; `created_by` → `auth.users(id)`
- **Índices:** `idx_purchase_order_items_order(order_id)`
- **Triggers:** `trg_purchase_order_items_updated_at`
- **RLS:** dono (`created_by`) tem `ALL`; admin tem `SELECT`/`INSERT`/`UPDATE` (`purchase_order_items_admin_*` + `purchase_order_items_select_admin`).

### `purchase_order_actions`
Trilha de ações sobre um pedido (append-only).

| Coluna | Tipo | Null | Default | Observações |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | **PK** |
| `order_id` | uuid | não | — | FK → `purchase_orders(id)` `ON DELETE CASCADE` |
| `created_by` | uuid | não | — | FK → `auth.users(id)` `ON DELETE CASCADE` |
| `action_type` | text | não | — | `pedido_criado \| entrada_realizada \| bonus_gerado \| devolucao_pendente \| devolucao_emitida \| reimpressao \| auditoria` |
| `action_label` | text | sim | — | |
| `notes` | text | sim | — | |
| `payload` | jsonb | não | `'{}'` | |
| `created_at` | timestamptz | não | `now()` | Sem `updated_at` (append-only) |

- **PK:** `id` · **FKs:** `order_id` → `purchase_orders(id)`; `created_by` → `auth.users(id)`
- **Índices:** `idx_purchase_order_actions_order(order_id, created_at desc)`
- **Triggers:** nenhum
- **RLS:** dono (`created_by`) tem `ALL`; admin tem `SELECT`/`INSERT` (`purchase_order_actions_admin_*` + `purchase_order_actions_select_admin`). Sem `UPDATE`/`DELETE` (append-only).

---

## Domínio 8 — Admin (papéis, fila de bônus, views)

### `admin_users`
Registro de quem é admin/supervisor/auditor. A presença de uma linha aqui faz `is_admin_user()` retornar `true`.

| Coluna | Tipo | Null | Default | Observações |
|---|---|---|---|---|
| `user_id` | uuid | não | — | **PK**; FK → `auth.users(id)` `ON DELETE CASCADE` |
| `role` | text | não | `'admin'` | `admin \| supervisor \| auditor` |
| `created_at` | timestamptz | não | `now()` | |
| `updated_at` | timestamptz | não | `now()` | Trigger `set_updated_at` |

- **PK:** `user_id` · **FKs:** `user_id` → `auth.users(id)`
- **Triggers:** `trg_admin_users_updated_at`
- **RLS:** `SELECT` para o próprio usuário OU admin (`admin_users_select_self_or_admin`); `UPDATE` só admin (`admin_users_update_admin_only`). Sem policy de `INSERT`/`DELETE` — o primeiro admin é promovido manualmente via SQL (bootstrap).

### `conferencia_bonus_queue`
Fila/pool compartilhado de conferência de bônus, importada de XML de NF. Operadores "assumem" tarefas.

| Coluna | Tipo | Null | Default | Observações |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | **PK** |
| `source_type` | text | não | `'xml_nf'` | `xml_nf \| manual` |
| `invoice_key` | text | sim | — | |
| `invoice_number` | text | não | — | |
| `supplier_name` | text | não | — | |
| `supplier_code` | text | sim | — | |
| `supplier_document` | text | sim | — | |
| `issued_at` | timestamptz | sim | — | |
| `item_count` | integer | não | `0` | |
| `total_quantity` | numeric(14,3) | não | `0` | |
| `status` | text | não | `'nao_iniciado'` | `nao_iniciado \| em_conferencia \| finalizada \| cancelada` |
| `imported_by` | uuid | sim | — | FK → `auth.users(id)` `ON DELETE SET NULL` |
| `assigned_user_id` | uuid | sim | — | FK → `auth.users(id)` `ON DELETE SET NULL`; operador que assumiu |
| `assigned_user_name` | text | sim | — | |
| `imported_payload` | jsonb | não | `'{}'` | |
| `started_at` | timestamptz | sim | — | |
| `finished_at` | timestamptz | sim | — | |
| `created_at` | timestamptz | não | `now()` | |
| `updated_at` | timestamptz | não | `now()` | Trigger `set_updated_at` |

- **PK:** `id` · **FKs:** `imported_by`, `assigned_user_id` → `auth.users(id)`
- **Índices:** `idx_conferencia_bonus_queue_status(status)`, `idx_conferencia_bonus_queue_invoice(invoice_number)`, `idx_conferencia_bonus_queue_created_at(created_at desc)`
- **Triggers:** `trg_conferencia_bonus_queue_updated_at`
- **RLS (pool compartilhado):**
  - `SELECT`: qualquer autenticado (`conferencia_bonus_queue_authenticated_select`).
  - `INSERT`: só admin (`conferencia_bonus_queue_admin_insert`).
  - `UPDATE`: admin **ou** linha não atribuída (`assigned_user_id is null`) **ou** a própria atribuição (`conferencia_bonus_queue_admin_update`). Endurecido em fixes_v3 — antes era `auth.uid() is not null` (qualquer um podia sequestrar).
  - `DELETE`: só admin (`conferencia_bonus_queue_admin_delete`, fixes_v2).

### `conferencia_bonus_queue_items`
Itens da fila de bônus.

| Coluna | Tipo | Null | Default | Observações |
|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | **PK** |
| `queue_id` | uuid | não | — | FK → `conferencia_bonus_queue(id)` `ON DELETE CASCADE` |
| `line_number` | integer | sim | — | |
| `code` | text | sim | — | |
| `ean` | text | sim | — | |
| `dun` | text | sim | — | |
| `description` | text | não | — | |
| `unit` | text | sim | — | |
| `expected_qty` | numeric(14,3) | não | `0` | |
| `created_at` | timestamptz | não | `now()` | |
| `updated_at` | timestamptz | não | `now()` | Trigger `set_updated_at` |

- **PK:** `id` · **FKs:** `queue_id` → `conferencia_bonus_queue(id)`
- **Índices:** `idx_conferencia_bonus_queue_items_queue(queue_id)`
- **Triggers:** `trg_conferencia_bonus_queue_items_updated_at`
- **RLS:** `SELECT` qualquer autenticado; `INSERT`/`UPDATE` só admin (`conferencia_bonus_queue_items_*`). Sem `DELETE` próprio (cascade via fila).

---

## Funções e triggers

| Função | Tipo | Descrição |
|---|---|---|
| `public.set_updated_at()` | trigger (plpgsql) | Seta `new.updated_at = now()` em BEFORE UPDATE. Usada por todas as tabelas com `updated_at`. |
| `public.handle_new_user_profile()` | trigger SECURITY DEFINER | AFTER INSERT em `auth.users`: cria/upsert linha em `profiles` com nome e e-mail. |
| `public.is_admin_user()` | sql STABLE SECURITY DEFINER | Retorna `true` se `auth.uid()` está em `admin_users`. Base de toda RLS de admin. |
| `public.admin_force_sign_out(target_user_id uuid)` | plpgsql SECURITY DEFINER | Verifica admin, marca sessões do alvo como `signed_out`, retorna nº de sessões encerradas. `GRANT EXECUTE` para `authenticated`. |

**Triggers de domínio:** `on_auth_user_created_profile` (em `auth.users`). Todos os demais são `trg_<tabela>_updated_at` rodando `set_updated_at` em BEFORE UPDATE.

---

## Storage

- Bucket privado **`product-images`** (`public = false`), criado idempotentemente.
- Policies em `storage.objects` (bucket `product-images`), escopadas pela **primeira pasta do path = UID do usuário** (`auth.uid()::text = (storage.foldername(name))[1]`):
  - `storage_read_own_product_images` (SELECT)
  - `storage_insert_own_product_images` (INSERT)
  - `storage_update_own_product_images` (UPDATE)
  - `storage_delete_own_product_images` (DELETE)
- Convenção de path: `{user_id}/...`. Referenciado por `validade_products.image_path` e `product_snapshot.imagePath`.

---

## Views `admin_*`

Todas as views têm `security_invoker = on` (fixes_v3) — rodam com os privilégios de quem consulta,
então a RLS das tabelas-base se aplica. `anon` perde acesso (`REVOKE ALL`); `authenticated` recebe
`GRANT SELECT`. Na prática: admin vê tudo, usuário comum vê só o seu, anônimo não vê nada.

| View | Fonte | O que expõe |
|---|---|---|
| `admin_active_users_view` | `user_presence` + `profiles` | Sessões `online`/`idle` com heartbeat < 1h; `status` recalculado para `offline` se heartbeat > 150s. Inclui nome/e-mail, dispositivo, plataforma, módulo/tela atuais, refs de pedido/lote. |
| `admin_tratativas_view` | `recebimento_treatment_cases` + `profiles` | Tratativas com nome/e-mail do usuário, doc, fornecedor, NFs origem/retorno, status, tipo de ocorrência/resolução, quantidades, `product_snapshot`, datas do ciclo. Ordenada por `updated_at desc`. |
| `admin_validade_products_view` | `validade_products` + `profiles` | Produtos de validade com nome/e-mail, códigos, lote, validade, quantidade, dias restantes, `location`, status e dados de tratamento. |
| `admin_avaria_items_view` | `avaria_items` + `avaria_batches` + `profiles` | Itens de avaria achatados com dados do lote (status, bônus, **supplier**, notes, datas) e do item (códigos, dano, resolução, **resolution_note**, status). Recriada em fixes_v2 para incluir fornecedor e nota. |
| `admin_conferencia_recebimentos_view` | `conferencia_recebimentos` + `profiles` | Achata o `payload`: `type`, `supplier`, `invoice`, `conferente`, `sync_status`, contagem de itens, contagem de divergências, e o payload bruto. |
| `admin_conferencia_saidas_view` | `conferencia_saidas` + `profiles` | Achata o `payload`: `type`, `orderCode`, `separador`, `embalador`, `sync_status`, contagem de itens/divergências, payload bruto. |
| `admin_conferencia_bonus_queue_view` | `conferencia_bonus_queue` + `profiles` | Cabeçalho da fila + nome/e-mail de quem importou (`imported_by`). Sem itens. |
| `admin_purchase_orders_view` | `purchase_orders` + `profiles` | Pedido completo (status agregados, contadores, timestamps do ciclo) + nome/e-mail do criador. |
| `admin_purchase_order_actions_view` | `purchase_order_actions` + `purchase_orders` + `profiles` | Ações com nome/e-mail do autor e dados do pedido (número, NF, fornecedor). |
| `admin_dashboard_summary_view` | múltiplas | Agregados de uma linha: usuários ativos (heartbeat < 150s), tratativas abertas, produtos de validade ativos, lotes/itens de avaria abertos, fila de bônus aberta, divergências pendentes (payload `status` ≠ `resolvida`). |

> Observação: nenhuma view referencia `auth.users` diretamente — apenas `profiles` (que tem policy de SELECT para admin), o que mantém o `security_invoker` funcional sem expor a tabela de auth.

---

## Resumo de RLS por tabela

| Tabela | Dono (SELECT/INSERT/UPDATE/DELETE) | Admin |
|---|---|---|
| `profiles` | SELECT, INSERT, UPDATE (próprio) | SELECT |
| `user_settings` | ALL (próprio) | SELECT |
| `validade_products` | ALL (próprio) | SELECT, UPDATE |
| `recebimento_treatment_cases` | ALL (próprio) | SELECT, UPDATE |
| `avaria_batches` | ALL (próprio) | SELECT, UPDATE, DELETE |
| `avaria_items` | ALL (próprio) | SELECT, UPDATE, DELETE |
| `conferencia_recebimentos` | ALL (próprio) | SELECT |
| `conferencia_saidas` | ALL (próprio) | SELECT |
| `conferencia_divergencias` | ALL (próprio) | SELECT |
| `purchase_orders` | ALL (`created_by`) | SELECT, INSERT, UPDATE |
| `purchase_order_items` | ALL (`created_by`) | SELECT, INSERT, UPDATE |
| `purchase_order_actions` | ALL (`created_by`) | SELECT, INSERT |
| `user_presence` | ALL (próprio) | SELECT (+ RPC force sign-out) |
| `operational_events` | INSERT + SELECT (próprio) | SELECT |
| `admin_users` | SELECT (próprio) | SELECT, UPDATE |
| `conferencia_bonus_queue` | SELECT (qualquer auth.) | INSERT, UPDATE*, DELETE (*UPDATE também p/ linha livre ou própria) |
| `conferencia_bonus_queue_items` | SELECT (qualquer auth.) | INSERT, UPDATE |

---

## Inconsistências observadas

1. **Mistura PT/EN nos nomes.** O schema alterna português e inglês entre e dentro das tabelas:
   `validade_products` (`descricao`, `codprod`, `quantidade`, `lote` em PT) vs `purchase_orders`/`avaria_items`
   (`description`, `code`, `quantity`→`expected_qty`, em EN). `recebimento_treatment_cases` mistura tudo
   (`doc_number`, `supplier_code`, `affected_quantity` em EN; `reasons` em EN mas valores em PT).

2. **Vocabulário de `status` divergente entre módulos.** Cada domínio inventou o seu:
   `validade_products` → `active/treated/resolved`; `avaria_*` → `open/concluded` e `damaged/resolved`;
   `recebimento_treatment_cases` → `ABERTA/EM ANDAMENTO/...` (**em MAIÚSCULAS, com espaços, em PT**);
   `purchase_orders` → `pedido_criado/...` (snake_case PT); `conferencia_bonus_queue` → `nao_iniciado/...`.
   Não há `CHECK` constraints nem enums — os valores válidos só existem como comentário.

3. **Sem `CHECK`/enums em campos categóricos.** Todos os `status`, `treatment_type`, `occurrence_type`,
   `resolution_type`, `action_type`, `role` etc. são `text` livre. O banco aceita qualquer string;
   a validação fica 100% no app. Risco de drift de valores (ex.: `'ABERTA'` vs `'Aberta'`).

4. **Tipos numéricos inconsistentes.** Quantidades são `integer` em `validade_products`,
   `recebimento_treatment_cases` e `avaria_items`, mas `numeric(14,3)` em `purchase_orders`,
   `purchase_order_items`, `conferencia_bonus_queue*`. Conversões/somas entre módulos podem perder
   precisão ou truncar.

5. **Campos legados duplicados (singular vs plural).** `recebimento_treatment_cases` mantém ao mesmo tempo
   `reason` (text) e `reasons` (text[]), `handling_method` (text) e `handling_methods` (text[]). A fonte de
   verdade é o array; os singulares só existem por compatibilidade e podem dessincronizar.

6. **`supplier_code` NOT NULL → nullable em momentos diferentes.** Em `recebimento_treatment_cases` foi
   criado `NOT NULL` (app_v1) e relaxado em fixes_v3 (o mapper enviava null e quebrava o sync). Quem aplicar
   só `app_v1` tem schema inconsistente com o app. Os 4 arquivos precisam rodar em ordem.

7. **Identificadores de produto sem entidade própria.** `codprod`/`codauxiliar`/`ean`/`dun`/`code`/`descricao`
   se repetem em validade, avaria, tratativas, purchase orders e bonus queue sem uma tabela `products`
   canônica nem FK. Cada módulo guarda seu próprio snapshot textual.

8. **`avaria_batches.supplier` vs `recebimento.product_snapshot.fornecedor` vs `purchase_orders.supplier_name`/`supplier_code`.**
   Três representações diferentes de "fornecedor" (coluna text simples, chave em JSON, par nome+código), sem
   tabela de fornecedores nem normalização.

9. **Conferência inteiramente em JSON.** `conferencia_recebimentos/saidas/divergencias` guardam tudo em
   `payload jsonb` sem colunas tipadas. As views admin reextraem campos com `->>`/casts (`(... ->> 'divergences')::int`),
   o que falha silenciosamente se a estrutura do JSON mudar. Não há índice GIN no `payload`.

10. **`operational_events.entity_id` é `text`** enquanto IDs reais são ora `uuid` (purchase orders, presence)
    ora `text` composto (validade, avaria). O log não consegue ter FK e o join é só por convenção.

11. **`current_order_ref`/`current_batch_ref` (presence) e `order_ref`/`batch_ref` (events) são `text` soltos**,
    sem FK para `purchase_orders`/`avaria_batches`. Referências frágeis para telemetria.

12. **`admin_users` sem policy de INSERT/DELETE.** Só dá pra promover admin via SQL direto (service role/console).
    Documentado como "bootstrap", mas não há fluxo gerenciado de conceder/revogar admin pela aplicação.

13. **Doc anterior desatualizado vs schema.** O `data-model.md` antigo descrevia chaves *locais* do app
    (`products`, `userData`, `userSettings`, rascunhos `*_em_andamento`) que **não existem como tabelas no
    Postgres**. Estes são armazenamento local (AsyncStorage) do app, não do banco — esta versão foca no schema
    Supabase real. (`treatmentType`/`imageUrl` do doc antigo são `treatment_type`/`image_path`/`imageUrl`-em-JSON no banco.)

14. **`conferencia_divergencias` não tem view admin própria.** Recebimentos e saídas têm
    `admin_conferencia_*_view`, mas divergências só aparecem agregadas no `admin_dashboard_summary_view`
    (contagem). Não há listagem admin detalhada das divergências.
