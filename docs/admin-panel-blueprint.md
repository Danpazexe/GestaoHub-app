# Painel Admin

## Leitura do código atual
- O repositório é somente mobile React Native; não existe frontend web/admin pronto em `package.json`.
- `validade` já sincroniza com Supabase por `src/services/validadeSupabaseService.js`.
- `recebimentoTratativa` já sincroniza com Supabase por `src/features/recebimentoTratativa/services/tratativaCaseService.js`.
- `conferencia` e `avaria` hoje operam principalmente em storage local:
  - `src/features/conferencia/services/conferenciaRecordsService.js`
  - `src/features/avaria/services/avariaBatchService.js`
- O schema atual (`supabase/schema_app_v1.sql`) foi desenhado com RLS por `user_id`, então um usuário comum só enxerga os próprios dados.

## O que o painel admin precisa mostrar

### 1. Operação em tempo real
- quem está logado
- qual módulo a pessoa está usando
- qual pedido/NF está em conferência
- último heartbeat do dispositivo
- usuário offline, online ou ocioso

### 2. Gestão operacional
- pedidos em conferência de recebimento
- pedidos em conferência de saída
- tratativas de recebimento abertas, em andamento e encerradas
- produtos de validade ativos e tratados
- lotes de avaria abertos e concluídos

### 3. Rastreabilidade
- evento de login/logout
- início e fim de conferência
- troca de status de tratativa
- resolução de item avariado
- trilha com `actor`, `module`, `entity_type`, `entity_id`, `payload`, data/hora

### 4. Avarias
- lista de lotes
- lista de itens por lote
- quantidade, tipo de dano, resolução e status
- filtro por fornecedor, lote, código e período

## Gap real entre o app atual e o painel desejado

### Já dá para alimentar o painel hoje
- `profiles`
- `validade_products`
- `recebimento_treatment_cases`

### Ainda não dá para responder de forma centralizada
- quem está logado agora:
  o app não publica presença/heartbeat no banco.
- qual pedido está sendo conferido agora:
  a conferência salva histórico local e não publica sessão ativa em tempo real.
- lista central de avarias:
  o app tem schema remoto para `avaria_batches` e `avaria_items`, mas a implementação atual ainda salva em storage local.
- rastreabilidade completa:
  existe status e timestamps em algumas entidades, mas não existe tabela única de eventos operacionais.

## Arquitetura recomendada

### Camada 1. Fundação de dados no Supabase
- criar tabela de admins
- criar helper `is_admin_user()`
- criar tabela de presença/sessão do app
- criar tabela de eventos operacionais
- liberar leitura admin nas tabelas operacionais existentes
- criar views prontas para o painel

### Camada 2. Ajustes no mobile
- publicar heartbeat ao abrir o app, trocar de tela e entrar/sair de conferência
- publicar login/logout
- sincronizar `avaria_batches` e `avaria_items` com Supabase
- sincronizar histórico de conferência com Supabase
- registrar eventos operacionais relevantes na tabela de auditoria

### Camada 3. Web admin
- stack recomendada:
  Next.js + Supabase + tabelas/filtros + dashboard em tempo real
- páginas mínimas:
  - visão geral
  - usuários online
  - conferências
  - tratativas
  - avarias
  - validade
  - auditoria

## Estrutura mínima das telas do admin

### Dashboard
- cards:
  usuários online, conferências ativas, tratativas abertas, avarias abertas
- listas rápidas:
  últimas tratativas atualizadas, últimas conferências finalizadas, últimos eventos

### Usuários online
- nome
- e-mail
- dispositivo
- módulo atual
- tela atual
- pedido/NF atual
- último ping

### Conferências
- tipo: recebimento ou saída
- fornecedor/NF ou pedido
- operador
- total de itens
- divergências
- status de sync
- timeline

### Tratativas
- documento `TR`
- fornecedor
- nota fiscal
- status
- tipo de ocorrência
- resolução
- responsável
- atualização

### Avarias
- lote
- fornecedor
- status
- tipo de bônus
- total de itens
- abrir detalhes do lote com todos os itens

## Ordem correta de implementação
1. Aplicar a fundação SQL do arquivo `supabase/schema_admin_panel_v1.sql`.
2. Definir manualmente o primeiro admin em `admin_users`.
3. Instrumentar presença no mobile.
4. Sincronizar `avaria` e `conferencia` para o banco.
5. Construir o frontend web admin.

## Prioridade prática
- Fase 1:
  admin lê validade + tratativas + presença
- Fase 2:
  admin lê conferências
- Fase 3:
  admin lê avarias com itens
- Fase 4:
  auditoria completa e ações remotas para o app

## Observação importante
- Sem presença remota e sem sync de `avaria`/`conferencia`, o painel não vai conseguir mostrar com precisão:
  - quem está logado agora
  - qual pedido está sendo conferido agora
  - lista central de avarias em tempo real
- Por isso a fundação do painel precisa começar no banco e no contrato de sync, não só na interface web.
