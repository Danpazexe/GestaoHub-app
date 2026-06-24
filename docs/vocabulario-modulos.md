# Vocabulário canônico por módulo

Referência única dos **enums e convenções** de cada módulo, para app e web NÃO
introduzirem valores fora do que o banco aceita. Fonte de verdade: os `CHECK`s de
domínio em `supabase/schema.sql` (são `NOT VALID` — travam escrita nova, não varrem
legado). Ao adicionar um valor novo, atualize o CHECK **e** este documento.

> Convenção de idioma: os **códigos** são em inglês/snake_case ou no formato legado de
> cada módulo; os **rótulos** de UI ficam em PT na camada de apresentação (app e web).
> Nunca grave o rótulo PT no banco.

## Validade (`validade_products`)

- **status**: `active` · `treated` · `resolved` · `resolvida` (legado web)
- **treatment_type**: `sold` (Vendido) · `exchanged` (Trocado) · `returned` (Devolvido) ·
  `expired` (Vencido) · `unknown` (fallback — não oferecer no UI). Nullable.
  - ⚠️ A web (ValidadeView) usa `value=código EN`, `label=PT`. Antes gravava
    `recolhimento/descarte/promoção/devolução`, que o CHECK rejeita.

## Avaria

- **avaria_batches.status**: `open` · `concluded`
- **avaria_batches.bonus_type** / **avaria_items.bonus_type**: `merchandise` · `money` · `exchange` (nullable)
- **avaria_items.status**: `damaged` · `resolved`
- **avaria_items.damage_type**: `broken` · `leaking` · `expired` · `spoiled` · `missing` · `other` (nullable)
- **avaria_items.resolution_type**: `discard` · `supplier_return` · `donation` · `discount_sale` · `stock_return` (nullable)

## Recebimento / Tratativas (`recebimento_treatment_cases`)

- **status**: `ABERTA` · `EM ANDAMENTO` · `AGUARDANDO` · `ENCERRADA` · `CANCELADA` (MAIÚSCULA + espaço)
- **occurrence_type**: `avaria` · `falta` · `outro`
- **resolution_type**: `devolucao` · `troca` · `tratativa` · `descarte`
  - legados (tratativaCaseMapper.js): `recolhimento`→devolucao, `reposicao`→troca, `abatimento`→tratativa
- Fonte de verdade dos arrays: `reasons[]` / `handling_methods[]`. As colunas singulares
  `reason` / `handling_method` são **legado/compat** — não gravar nelas.

## Conferência — fila de bônus

- **conferencia_bonus_queue.status** (entrada): `nao_iniciado` · `em_conferencia` · `finalizada` · `entrada_realizada` · `cancelada`
- **conferencia_bonus_queue.source_type**: `xml_nf` · `manual` · `purchase_order` · `recebimento`
- **conferencia_saida_bonus_queue.status** (saída): `nao_iniciado` · `em_conferencia` · `finalizada` · `saida_realizada` · `cancelada`

## Compras (`purchase_orders`)

- **status**: `pedido_criado` · `entrada_pendente` · `entrada_realizada` · `bonus_gerado` ·
  `devolucao_pendente` · `devolucao_emitida` · `auditado` · `encerrado` · `cancelado`
- **entry_status**: `pendente` · `parcial` · `realizada`
- **bonus_status**: `nao_gerado` · `gerado`
- **return_status**: `sem_devolucao` · `pendente` · `emitida`
- **audit_status**: `pendente` · `revisado` · `aprovado`
- **source_type**: `xml_nf` · `manual` · `avulso` · `purchase_order`
- **purchase_order_actions.action_type**: `pedido_criado` · `entrada_realizada` · `bonus_gerado` ·
  `devolucao_pendente` · `devolucao_emitida` · `reimpressao` · `auditoria`

## Núcleo

- **admin_users.role**: `admin` · `supervisor` · `auditor`
- **user_presence.status**: `online` · `idle` · `offline` · `signed_out`

## Coluna de dono (RLS)

- A maioria das tabelas escopa por **`user_id`** (= `auth.users.id`).
- **Exceção**: `purchase_orders` / `purchase_order_items` / `purchase_order_actions` usam
  **`created_by`**. Mesma noção de propriedade, nome diferente — não renomear (quebra RLS
  e código dos dois lados); apenas saiba disso ao ler policies/queries.
