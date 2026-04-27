# Especificação Funcional

## Overview

### Estado atual
- 5 `MetricCard`;
- 2 tabelas resumidas, uma para usuários online e outra para tratativas recentes.

### Evolução requerida
- adicionar cards de alerta rápido para:
  - validade até 7 dias;
  - avarias não resolvidas;
  - conferências com divergência;
- destacar linhas de usuários online/offline por status e tempo;
- botão `Ver todos` para navegar à view completa do módulo.

## Users

### Requisitos
- filtro por status;
- busca textual;
- ordenação;
- coluna de ações:
  - forçar logout com confirmação;
  - abrir histórico do usuário em `Drawer`.

### Regras visuais
- linhas offline há mais de 1 hora com menor opacidade.

## Tratativas

### Filtros
- status;
- busca por documento ou fornecedor.

### Ações
- encerrar;
- cancelar;
- ver detalhes em `Drawer`.

### Regras visuais
- `ABERTA`: fundo de aviso;
- `EM ANDAMENTO`: fundo informativo.

## Conferência

### Fila de bônus
- atribuir responsável;
- remover item da fila;
- refletir status e responsável de forma clara.

### Recebimento e saída
- cabeçalho de seção com exportação CSV;
- tabelas com busca e paginação;
- divergências com badge semântico, não só número cru.

## Avarias

### Filtros
- status do item;
- tipo de avaria;
- busca por produto.

### Ações
- resolver com modal e payload estruturado;
- excluir item com confirmação.

### Resumo
- total;
- pendentes;
- resolvidos.

## Validade

### Filtros
- status;
- dias restantes máximos;
- busca por produto.

### Ações
- aplicar tratativa;
- marcar como resolvido.

### Regras visuais
- urgência alta em vermelho;
- urgência média em laranja;
- ordenação padrão por `diasrestantes` crescente.

## Events

### Filtros
- módulo;
- tipo de evento;
- busca textual;
- período por `input type="date"`.

### Ações
- exportação CSV da lista filtrada;
- visualização do payload completo em `Drawer`.

## Novo módulo: Dashboard

### Navegação
- entra como primeiro item do grupo geral.

### Blocos previstos
- faixa de KPIs;
- área de tratativas por status;
- donut de avarias por tipo;
- barras de urgência de validade;
- cards compactos de usuários online;
- linha do tempo de eventos recentes.

### Requisitos de fallback
- toda seção deve prever estado vazio;
- nenhum gráfico pode quebrar quando `rows.length === 0`.

## Fluxo de conferência e bônus

O painel precisa suportar dois caminhos:

- importar XML de NF e gerar bônus;
- montar bônus manualmente com produtos, quantidades e embalagens.

Esse bônus precisa seguir para o app com:

- fornecedor;
- NF;
- itens;
- quantidades esperadas;
- embalagens configuradas;
- identificadores de leitura como EAN e DUN.
