# Plano de Rename de Schema — Análise de Risco (NÃO EXECUTAR ainda)

> Análise de organização de nomenclatura das tabelas/colunas Supabase do GestãoHub.
> **Nada foi alterado.** Este documento é só um mapa de risco para decisão.
> Contexto crítico: **banco em PRODUÇÃO** + app **JS sem tipos** (erro de coluna só
> aparece em **runtime**, geralmente como `null` silencioso ou `PGRST` no console).

Fontes lidas: `schema_app_v1.sql`, `schema_admin_panel_v1.sql`, `schema_fixes_v2.sql`,
`schema_fixes_v3.sql`. Grep exaustivo em `GestaoHub-app/src` e `GestaoHub-web/src`.

---

## 1. Como o código referencia o banco (fato que define todo o risco)

Antes de propor renames é preciso entender o acoplamento real:

- **Nomes de TABELA** estão centralizados. O app usa, por serviço, um
  `const TABLE = '...'` (ex.: `validadeSupabaseService.js`, `tratativaCaseService.js`,
  `avariaSupabaseService.js`, `conferenciaBonusQueueService.js`). O `.from('...')`
  literal aparece em pouquíssimos lugares. A web (`adminApi.js`) usa strings literais
  em `.from('...')` / `readMany('...')`, mas todas concentradas num único arquivo.
  → **Renomear uma tabela toca poucos pontos** (1–2 arquivos por tabela), MAS é o tipo
  de mudança que exige migração de dados em produção (a tabela física muda de nome).

- **Nomes de COLUNA** têm acoplamento MUITO desigual conforme o módulo:
  - **Avaria** → bem isolado. As colunas pt/snake (`descricao`, `codprod`, `quantidade`,
    `lote`, `damage_type`...) só aparecem nos **mappers** (`mapItemToRemote` /
    `mapBatchToRemote` em `avariaSupabaseService.js`) e na view admin + `AvariasView.jsx`.
    O modelo local usa camelCase (`quantity`, `damageType`) e o mapper traduz.
  - **Validade** → **vazado**. As colunas do banco (`codprod`, `descricao`, `codauxiliar`,
    `lote`, `validade`, `quantidade`, `diasrestantes`) **são** o shape do objeto em memória
    do app inteiro. `validadeSupabaseService.js` faz pass-through (não traduz essas chaves).
    Logo `descricao` aparece **~70x** no app, `codprod` **~68x**, `validade` **~139x** —
    a maioria NÃO é "referência a coluna", é lógica de domínio/UI usando a mesma string.
  - **Tratativa (recebimento)** → **muito vazado**. O form, hooks de validação, telas e PDF
    usam snake_case direto (`form.supplier_code`, `item.doc_number`,
    `origin_invoice_number`, `product_snapshot`...). ~**223 linhas** na pasta
    `recebimentoTratativa/` mencionam essas colunas. O "mapper" mapeia snake→snake.

- **VIEWS `admin_*`** são o contrato da web. A web faz `select('*')` e lê as colunas da
  view direto no JSX (`row.codprod`, `row.diasrestantes`, `row.doc_number`...). Qualquer
  rename de coluna numa tabela-base **obriga** a recriar a view correspondente
  (a view lista colunas explicitamente) **e** ajustar o JSX que lê o alias.

- **Falsos positivos importantes (NÃO quebram com rename de DB):**
  - `src/constants/storage.js` — chaves como `'avaria_batches'`,
    `'recebimento_treatment_cases'`, `'conferencia_recebimentos'` são **chaves de
    AsyncStorage local**, não tabelas. Renomeá-las **órfã os dados locais** dos apps já
    instalados. Deixar como estão.
  - `src/features/sql/constants/schemas.js:35` `id: 'avaria_batches'` — id de UI.
  - Labels de `admin_tratativas_view` / `getTratativas()` na web são nomes de método/rota,
    não dependem do nome físico da tabela `recebimento_treatment_cases`.

---

## 2. Inconsistências de nomenclatura encontradas

| # | Padrão inconsistente | Exemplos |
|---|---|---|
| A | **Mistura PT/EN em colunas** dentro da MESMA tabela | `validade_products`: `descricao`, `codprod`, `quantidade`, `lote`, `validade`, `diasrestantes` (PT) convivem com `status`, `treatment_type`, `image_path`, `created_at` (EN). Mesmo caso em `avaria_items`. |
| B | **Abreviações cruas / sem separador** | `codprod`, `codauxiliar`, `diasrestantes` (deveria ser `dias_restantes`), `descricao`. `diasrestantes` é o pior: viola o próprio snake_case do resto do schema. |
| C | **Mistura PT/EN em nomes de TABELA** | `validade_products`, `recebimento_treatment_cases`, `conferencia_bonus_queue` (prefixo PT + sufixo EN) vs. `purchase_orders`, `user_presence`, `operational_events` (full EN). |
| D | **Prefixo PT vs. nome EN da entidade** | Tabela `recebimento_treatment_cases` é exposta na view como `admin_tratativas_view` e na web como `getTratativas` — três nomes para a mesma coisa (recebimento/treatment/tratativa). |
| E | **`reason`/`reasons` e `handling_method`/`handling_methods` duplicados** | `recebimento_treatment_cases` tem singular **e** plural array da mesma ideia (legado de migração). Não é "rename" e sim dívida de modelagem. |

---

## 3. Renames propostos (conjunto mínimo, alto valor) + blast radius

Para cada item: pontos de código que quebrariam (com arquivos), se há **dado a migrar**,
e classificação de esforço/risco.

### R1 — `validade_products.diasrestantes` → `dias_restantes`  *(coluna)*
Único caso onde a abreviação **também** quebra a convenção snake_case do schema.
- **App** (`diasrestantes` ~9 ocorrências, mas só algumas são a coluna):
  - `services/validadeSupabaseService.js` (payload `:31` e map `:89`) — **ponto de DB real**.
  - `features/validade/screens/ListScreen.js` (`:136,:688`), `AddProductScreen.js` (`:329`) —
    objeto de domínio (pass-through).
  - (`PdfScreen.js` usa `diasRestantes` camelCase local — **não** é a coluna; `DashboardScreen.js`
    usa `dias_restantes` como chave de export — **não** é a coluna.)
- **Web** (todas leem a view): `validade/ValidadeView.jsx` (5x, inclusive `key:'diasrestantes'`),
  `dashboard/DashboardView.jsx` (`:77`), `overview/OverviewView.jsx` (`:19`).
- **SQL**: `admin_validade_products_view` seleciona `vp.diasrestantes`.
- **Dado a migrar:** SIM (rename de coluna física).
- **Esforço/Risco:** **MÉDIO**. ~10 pontos. Risco moderado: o pass-through do app significa
  que esquecer um ponto = valor vira `undefined`/`null` em runtime sem erro. Ganho de
  organização: **alto** (é a coluna mais feia do schema).

### R2 — `validade_products` colunas PT → EN  *(descricao→description, codprod→product_code, codauxiliar→aux_code/barcode, quantidade→quantity, validade→expiry_date, lote→batch)*  *(colunas)*
- **App:** `descricao` ~70, `codprod` ~68, `codauxiliar` ~53, `quantidade` ~68,
  `validade` ~139, `lote` ~63 ocorrências — espalhadas por **dezenas** de telas/serviços de
  `features/validade/`, `features/avaria/`, `features/conferencia/`, `features/sql/`
  (essas chaves são o shape de domínio compartilhado entre módulos).
- **Web:** `descricao` 6, `codprod` 8, etc. em `ValidadeView.jsx`, `DashboardView.jsx`,
  `RecebimentoView.jsx`, `AvariasView.jsx`.
- **SQL:** `admin_validade_products_view` e (parcialmente) `admin_avaria_items_view`.
- **Dado a migrar:** SIM.
- **Esforço/Risco:** **MUITO ALTO**. Centenas de pontos, atravessa módulos, e o app é
  pass-through (sem camada de tradução para isolar). **NÃO recomendado** (ver §5).

### R3 — `avaria_items` colunas PT → EN  *(descricao→description, codprod→product_code, quantidade→quantity, lote→batch)*  *(colunas)*
Mesmo cheiro do R2, mas **isolado**: o app já traduz no mapper.
- **App:** só `avariaSupabaseService.js` (`mapItemToRemote`, linhas 20–24) — **1 arquivo**,
  ~4 linhas. (O resto do módulo avaria já usa `quantity`/`damageType` camelCase.)
- **Web:** `AvariasView.jsx` lê `item.descricao`/`item.codprod` da view (poucos pontos).
- **SQL:** `admin_avaria_items_view` (recriada em `schema_fixes_v2.sql`).
- **Dado a migrar:** SIM.
- **Esforço/Risco:** **MÉDIO-BAIXO** por estar isolado, mas **ganho baixo** (são poucas
  colunas e a view já normaliza a leitura). Custo-benefício morno.

### R4 — Tabela `recebimento_treatment_cases` → `treatment_cases` (ou `tratativa_cases`)  *(tabela)*
Tira o prefixo PT redundante e alinha com o nome usado em todo lado (`tratativas`).
- **App:** **1 ponto** — `const TABLE = 'recebimento_treatment_cases'` em
  `tratativaCaseService.js:17`. (Mais a chave AsyncStorage homônima em `storage.js` que
  **NÃO** deve mudar.)
- **Web:** **1 ponto** — `adminApi.js:799` `.from('recebimento_treatment_cases')`.
- **SQL:** `admin_tratativas_view` (FROM), `admin_dashboard_summary_view` (subselect),
  ~7 policies, índices, trigger, e os `alter table` de `schema_fixes_v3.sql`.
- **Dado a migrar:** SIM (rename de tabela física + recriar policies/índices/trigger/views).
- **Esforço/Risco:** **ALTO no SQL, BAIXO no código JS**. O JS quebra em só 2 lugares, mas
  a tabela carrega muita infra (RLS, views, FKs implícitas). Ganho de clareza médio.

### R5 — Tabela `conferencia_bonus_queue` → manter  *(tabela)* — **avaliada e descartada**
Prefixo `conferencia_` (PT) + `bonus_queue` (EN) é inconsistente, mas a tabela aparece em
app (`conferenciaBonusQueueService.js`), web (`adminApi.js`, 4x), view
`admin_conferencia_bonus_queue_view`, tabela-filha `conferencia_bonus_queue_items` (com FK
`queue_id`), policies e dashboard. Blast radius desproporcional ao ganho. **Não fazer.**

### R6 — `recebimento_treatment_cases`: colunas PT/snake vazadas → manter  *(colunas)* — **descartada**
`supplier_code`, `doc_number`, `origin_invoice_number`, `product_snapshot`, etc. estão em
**~223 linhas** do módulo `recebimentoTratativa/` (form, validação, telas, PDF, mapper) +
`admin_tratativas_view` + `TratativasView.jsx` + `adminApi.updateTratativa`. Sem camada de
tradução. **Risco >> ganho. Não fazer.**

---

## 4. Tabela-resumo de custo/risco

| Rename | Tipo | Pontos JS (app) | Pontos JS (web) | SQL afetado | Migrar dado | Risco | Ganho | Veredito |
|---|---|---|---|---|---|---|---|---|
| R1 `diasrestantes`→`dias_restantes` | coluna | ~5 reais (de 9) | 7 | 1 view | Sim | Médio | **Alto** | **FAZER** (com cuidado) |
| R4 `recebimento_treatment_cases`→`treatment_cases` | tabela | 1 | 1 | 2 views, ~7 policies, índices, trigger | Sim | Médio (SQL) | Médio | **Talvez** (janela calma) |
| R3 `avaria_items` PT→EN | colunas | 1 arq (~4 linhas) | poucos | 1 view | Sim | Médio-baixo | Baixo | Opcional |
| R2 `validade_products` PT→EN | colunas | ~300+ | ~20 | 1 view | Sim | **Muito alto** | Alto | **NÃO FAZER** |
| R5 `conferencia_bonus_queue` | tabela | vários | 4 | view + filha + policies | Sim | Alto | Médio | **NÃO FAZER** |
| R6 tratativa colunas PT→EN | colunas | ~223 linhas | vários | view | Sim | **Muito alto** | Médio | **NÃO FAZER** |

---

## 5. Recomendação honesta

**Vale a pena? Em sua maioria, NÃO — e o motivo é estrutural, não estético.**

O acoplamento aqui é traiçoeiro porque o app é **JS sem tipos** e faz **pass-through** das
colunas do banco como shape de domínio nos dois módulos que mais doem (validade e
tratativa). Renomear uma coluna desses módulos não é "buscar e substituir num mapper" — é
mexer em telas, validações, PDFs e exports, onde **um ponto esquecido não dá erro de
compilação: vira `undefined` silencioso em produção**. Para ganho puramente cosmético
(PT→EN), o risco de regressão silenciosa em fluxo crítico (validade de produto, tratativa
de recebimento) não se justifica.

**O que tem bom custo-benefício e eu faria:**

1. **R1 — `diasrestantes` → `dias_restantes`.** É a única inconsistência que quebra a
   própria convenção do schema (snake_case), o blast radius é pequeno e enumerável (~5
   pontos reais no app + 7 na web + 1 view), e o ganho de coerência é alto. **Recomendo
   fazer**, com a técnica segura abaixo.

2. **R4 — `recebimento_treatment_cases` → `treatment_cases`** (rename só da TABELA, não das
   colunas). O JS quebra em apenas 2 linhas (uma constante no app, um `.from` na web).
   O custo está no SQL (recriar view/policies/índices/trigger). Vale **se** houver janela
   calma para reaplicar a infra com cuidado. Sozinho dá pouco retorno; só faz sentido se
   já for mexer no SQL desse módulo por outro motivo.

**O que eu NÃO faria (risco > ganho):**

- **R2** (colunas de `validade_products`) e **R6** (colunas de tratativa): centenas de
  pontos, sem camada de isolamento, em fluxos críticos. Deixar PT/EN misto é feio mas
  **estável**.
- **R5** (`conferencia_bonus_queue`): blast radius grande (tabela + filha + FK + view +
  policies) para ganho médio.
- **Não renomear** as chaves de `src/constants/storage.js` — são AsyncStorage local;
  renomear **órfã os dados** dos apps instalados.

### Como executar R1/R4 com segurança (técnica de migração sem downtime)

Como é produção + app JS antigo ainda em campo, **rename atômico quebra clientes antigos**.
Preferir migração em fases:

1. **Adicionar** a coluna/visão nova (`dias_restantes`) e uma **view ou coluna gerada** que
   espelhe a antiga, ou popular ambas via trigger, mantendo `diasrestantes` por compat.
2. **Soltar release** do app + web lendo/escrevendo o nome novo.
3. Após adoção, **dropar** o nome antigo.

Para R4 (tabela), uma alternativa de baixo risco é **`create view recebimento_treatment_cases
as select * from treatment_cases`** temporariamente, para não quebrar nenhum cliente durante
a transição. Sempre **rodar num branch/projeto de staging do Supabase primeiro** e validar o
painel admin + sync do app de ponta a ponta antes de aplicar em produção.

> Resumo de uma linha: **faça só o `diasrestantes`→`dias_restantes` agora** (alto valor,
> risco contível); trate o resto como dívida documentada e deixe quieto.
