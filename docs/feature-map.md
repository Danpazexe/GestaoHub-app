# Mapa de Features

## Home
- módulos expostos:
  validade, conferência e avaria.

## Validade
- `ListScreen`: lista operacional de produtos e tratativa legada por item.
- `AddProductScreen`: cadastro e edição.
- `DashboardScreen`: visão analítica e exportações.
- `TratarScreen`: histórico legada de itens tratados.
- `ExcelScreen`: importação e exportação da base.
- `PdfScreen`: exportação da lista de validade em PDF.

## Conferência
- `ConferenciaRecebimentoScreen`: conferência cega de recebimento.
- `ConferenciaSaidaScreen`: conferência cega de saída.
- `ConferenciaDivergenciasScreen`: visualização de divergências.
- `ConferenciaTratativasRecebimentoScreen`: lista das ocorrências/espelhos de recebimento.
- `EspelhoRecebimentoScreen`: criação, edição e exportação do espelho manual de recebimento.

## Avaria
- `AvariaEntryScreen`: criação e edição de lote.
- `AvariaListScreen`: lotes abertos.
- `AvariaHistoryScreen`: histórico de lotes concluídos.
- `AvariaDashboardScreen`: indicadores.
- `AvariaResolutionScreen`: resolução de item.

## Configuração e apoio
- `NotificationScreen`: configuração de alertas.
- `ProfileScreen`: dados locais do usuário.
- `SettingsScreen`: preferências e atalhos operacionais.

## Regras de navegação importantes
- tratativa de validade continua dentro do módulo de validade e nasce do swipe em `ListScreen`.
- tratativa de recebimento é avulsa e pertence ao fluxo de conferência, não ao módulo de validade.
- rotas públicas existentes podem ser preservadas, mas o ponto canônico da implementação deve existir em `src/features/*`.
