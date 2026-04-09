# Modelo de Dados

## Chaves locais centrais
- `products`: base operacional do módulo de validade.
- `recebimento_treatment_cases`: cache local dos espelhos de recebimento.
- `conferencia_recebimentos`, `conferencia_saidas`, `conferencia_divergencias`: histórico operacional da conferência.
- `conferencia_recebimentos_em_andamento`, `conferencia_saidas_em_andamento`: rascunhos de conferência.
- `avaria_batches`: lotes de avaria.
- `userData`, `userSettings`, `savedEmail`, `savedPassword`, `biometricEnabled`: sessão e preferências.
- `name`, `email`, `password`, `profileImage`: perfil local.

## Validade

### Cache `products`
- contém produtos ativos, tratados e itens derivados por split.
- campos mais usados:
  `id`, `codprod`, `descricao`, `codauxiliar`, `lote`, `validade`, `quantidade`, `diasrestantes`, `status`, `treatmentType`, `treatmentDate`, `imageUrl`, `imagePath`, `location`.

### `product.location`
- objeto opcional de localização logística por produto.
- chaves suportadas:
  `corredor`, `prateleira`, `nivel`, `aereo`, `picking`, `gondola`, `observacao`.
- o app preserva valores já salvos mesmo quando algum campo deixa de ficar visível na configuração.

### Tabela `validade_products`
- backend principal da lista de validade.
- continua sendo a entidade operacional do estoque/lista.
- itens tratados permanecem no mesmo conjunto para sustentar dashboard, histórico e exportações legadas.
- passa a aceitar `location` como `jsonb`, espelhando o contrato local do produto.

## Conferência

### Recebimento e saída
- registros são salvos localmente como coleções históricas.
- divergências são entidades próprias derivadas do fechamento da conferência.
- rascunhos são separados por tipo para permitir retomada sem contaminar o histórico final.

## Tratativas de recebimento

### Tabela `recebimento_treatment_cases`
- entidade oficial do espelho de ocorrência de recebimento.
- modelo atual do app:
  `id`, `user_id`, `doc_number`, `doc_sequence_number`, `supplier_code`, `supplier_name`, `origin_invoice_number`, `return_invoice_number`, `occurrence_type`, `resolution_type`, `status`, `status_updated_at`, `product_snapshot`, `received_quantity`, `expected_quantity`, `affected_quantity`, `reasons`, `reason`, `observation`, `opened_at`, `started_at`, `expected_end_at`, `closed_at`, `created_at`, `updated_at`.
- `product_snapshot` concentra os dados que precisam sobreviver a futuras mudanças de cadastro:
  `codprod`, `codauxiliar`, `descricao`, `fornecedor`, `lote`, `validade`, `quantidade_original`, `imageUrl`, `imagePath`.
- `doc_number` segue o padrão `TR {supplier_code} - {NNNN}`.
- `reason` continua como derivado textual por compatibilidade; a fonte de verdade da UI é `reasons`.

## Avaria

### `avaria_batches`
- lote local com `id`, `supplierName`, `bonusType`, `notes`, `items`, `status`, `createdAt`, `updatedAt`.
- `items` concentram descrição, código, quantidade e tipo de dano.

## Perfil e configurações
- perfil local usa chaves dedicadas, mas já é acessado via serviço.
- configurações ficam agrupadas em `userSettings`.
- `userSettings.logisticsLocationConfig` guarda a configuração da localização logística.
- o contrato canônico da configuração é:
  `corredor`, `prateleira`, `nivel`, `aereo`, `picking`, `gondola`, `observacao`.
- cada chave usa:
  `{ enabled: boolean, required: boolean }`.

## Regras de compatibilidade
- campos antigos podem continuar existindo no banco/cache se a UI nova já trabalhar com um contrato mais estruturado.
- quando houver contrato legado e novo, o mapper converte na leitura e regrava o formato novo quando possível.
