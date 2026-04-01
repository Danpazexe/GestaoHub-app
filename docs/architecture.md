# Arquitetura Mobile

## Fonte de verdade
- `docs/*` descreve o padrão canônico do app.
- `.codex/skills/gestao-mobile-standards/*` replica as regras operacionais que Codex deve seguir ao tocar este repositório.
- `src/features/recebimentoTratativas` é a referência principal de composição por domínio e separação entre UI, serviço, storage e contrato.

## Estrutura canônica
- `src/features/<dominio>/components`: componentes locais do domínio.
- `src/features/<dominio>/constants`: catálogos, enums visuais e tema local.
- `src/features/<dominio>/mappers`: normalização entre formulário, cache e remoto.
- `src/features/<dominio>/screens`: ponto de entrada canônico das rotas do domínio.
- `src/features/<dominio>/services`: regras de negócio, sincronização, exportação e side effects.
- `src/features/<dominio>/storage`: acesso encapsulado ao cache local.
- `src/components/*`: shell e componentes transversais do app.
- `src/services/*`: integrações compartilhadas, lookup global, bridge de storage, Supabase e utilidades de plataforma.

## Estado atual da migração
- `recebimentoTratativas` já nasce como feature completa.
- `validade`, `conferencia`, `avaria`, `notifications`, `profile` e `settings` já expõem entradas em `src/features/*`.
- `src/features/*` é a única origem canônica das telas públicas do app.
- Telas internas ou de diagnóstico devem sair da navegação pública e viver sob `src/internal/*` quando fizer sentido.

## Responsabilidades por camada
- screen:
  composição visual, navegação, estados de loading/empty/error/success, delegação para serviços.
- service:
  leitura, escrita, sincronização, exportação, regras de aplicação e validações transversais.
- storage:
  leitura/escrita local sem vazar `AsyncStorage` para a UI.
- mapper:
  compatibilidade entre contratos antigos e novos, snapshots e serialização.

## Regras obrigatórias
- Nova feature entra em `src/features/<dominio>`.
- Tela nova ou migrada não acessa `AsyncStorage` diretamente se já existir service/storage dedicado.
- `ScreenLayout`, `createScreenHeaderTemplate`, `createHeaderTitleTemplate` e `createHeaderActionsTemplate` são o shell padrão de tela.
- `src/theme/*` é a fonte de verdade para tokens visuais; `src/components/coresAuth.js` existe apenas como bridge temporária de compatibilidade.
- Fluxo offline salva local primeiro e sincroniza remoto depois.
- Documento HTML/PDF nasce de dados normalizados, nunca de estado ad hoc espalhado pela tela.

## Checklist para tela nova ou migrada
- usar `ScreenLayout` e header padrão.
- expor estados `loading`, `empty`, `error` e `success` quando fizer sentido.
- dividir formulários grandes em blocos visuais.
- manter persistência fora do componente.
- concentrar busca, cache e exportação em serviços.

## Domínios principais
- `validade`:
  lista operacional de produtos, cadastro, dashboard, histórico de tratativas, exportações.
- `conferencia`:
  recebimento, saída e divergências operacionais.
- `recebimentoTratativas`:
  espelho manual de ocorrência de recebimento, PDF, cache local e sync Supabase.
- `avaria`:
  lotes, histórico, dashboard e resolução.
- `notifications`:
  configuração e agendamento de alertas de validade.
- `profile` e `settings`:
  preferências e dados locais do usuário no mesmo padrão de shell e storage.
