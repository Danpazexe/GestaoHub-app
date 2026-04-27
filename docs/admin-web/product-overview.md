# Produto e Escopo

## Visão geral

O GestãoHub é um produto B2B de logística e gestão operacional para empresas
de varejo e distribuição no Brasil. O ecossistema é formado por dois sistemas:

- app móvel React Native, usado por operadores no armazém;
- painel web administrativo, usado por gestores e supervisores para monitorar,
  auditar e agir sobre a operação.

## Objetivo do painel admin

O painel web existe para consolidar o que o app operacional gera no chão de
armazém:

- operação em tempo real;
- indicadores por módulo;
- fila de conferência e bônus;
- tratativas, avarias e validade;
- rastreabilidade e auditoria.

## Módulos operacionais do produto

| Módulo | Papel no negócio |
| --- | --- |
| `validade` | controla produtos por lote e urgência de vencimento |
| `conferência` | cobre recebimento, saída, divergências e fila de bônus |
| `avaria` | registra danos, resolução e descarte/reposição |
| `tratativas` | acompanha ocorrências de recebimento |
| `transferências` | movimentação entre depósitos, ainda em roadmap |
| `inventário cíclico` | contagem periódica por zona, ainda em roadmap |

## Personas do painel

- `admin master`: visão total, auditoria completa, gestão de usuários e ações críticas.
- `supervisor`: acompanha conferência, tratativas, avarias e validade.
- `analista`: leitura, filtros e exportações.

## Stack obrigatória

Não alterar a base tecnológica do painel:

- `React 18`
- `Vite`
- `CSS puro com variáveis CSS`
- `Supabase` para auth, database, realtime e storage

Dependências adicionais permitidas:

- `recharts`
- `react-hot-toast`

Dependências explicitamente fora do padrão:

- bibliotecas completas de UI;
- Tailwind, CSS Modules, Styled Components;
- React Query, SWR, Lodash;
- Framer Motion.

## Fontes e linguagem visual

- fonte display: `Syne`
- fonte corpo: `DM Sans`
- linguagem: administrativa, clara, premium, brasileira e sem excesso visual

## Entidades Supabase relevantes

- `profiles`
- `admin_users`
- `user_presence`
- `recebimento_treatment_cases`
- `avaria_batches`
- `avaria_items`
- `validade_products`
- `conferencia_bonus_queue`
- `conferencia_recebimentos`
- `conferencia_saidas`
- `operational_events`

## Resultado esperado

O painel precisa operar como superfície administrativa real, não só como
dashboard passivo. Isso implica:

- leitura consolidada dos dados;
- ações seguras com confirmação;
- exportação;
- foco em monitoramento e resposta operacional;
- responsividade para desktop, tablet e mobile.
