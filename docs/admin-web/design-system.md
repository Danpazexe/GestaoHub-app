# Design System do Painel

## Tokens de cor

```css
--ink: #0d1f1b;
--ink-2: #263430;
--ink-3: #3d514c;
--muted: #607870;
--muted-2: #8fa49e;

--bg: #eee8df;
--surface: rgba(255, 252, 248, 0.93);
--surface-2: rgba(255, 250, 244, 0.98);

--accent: #1b6b52;
--accent-2: #25a07a;
--accent-3: #ffb319;
--danger: #bf3b2f;
--warning: #a05a10;
--info: #1d55c8;

--line: rgba(13, 31, 27, 0.09);
--line-2: rgba(13, 31, 27, 0.05);
--shadow-xl: 0 32px 80px rgba(20, 40, 30, 0.10);
--shadow-lg: 0 16px 48px rgba(20, 40, 30, 0.08);
--shadow-sm: 0 4px 16px rgba(20, 40, 30, 0.06);
```

## Tokens de layout e tipografia

```css
--r-xl: 24px;
--r-lg: 18px;
--r-md: 12px;
--r-sm: 8px;

--sb-w: 260px;
--sb-w-mini: 72px;

--font-display: 'Syne', sans-serif;
--font-body: 'DM Sans', sans-serif;
```

## Componentes-base obrigatórios

### `MetricCard`
- card de KPI com acento lateral, número grande e nota explicativa;
- usado no overview e dashboard;
- deve formatar números em `pt-BR`.

### `PanelSection`
- container padrão de seção;
- suporta `kicker`, `title`, `subtitle` e `actions`;
- é a base de views, painéis, tabelas e gráficos.

### `DataTable`
- tabela genérica com suporte a:
  - colunas declarativas;
  - busca;
  - ordenação;
  - paginação;
  - render custom por coluna.

### `StatusBadge`
- badge com dot semântico por status;
- mapeia visualmente estados como `ABERTA`, `ENCERRADA`, `damaged`, `resolved`.

### `AppIcon`
- SVG inline, sem dependência externa;
- ícones funcionais devem receber `aria-label`;
- ícones decorativos usam `aria-hidden="true"`.

## Utilitários visuais previstos

- `.feedback.error`
- `.feedback.warning`
- `.feedback.success`
- `.empty-state`
- `.inline-loading`
- `.ghost-button`
- `.danger-button`
- `.primary-button`
- `.filter-bar`

## Comportamento visual esperado

- visual administrativo premium, sem parecer template genérico;
- contraste claro entre superfícies, ações e estados;
- cards e seções com hierarquia nítida;
- filtros claros e legíveis;
- feedback imediato em ações destrutivas ou operacionais.

## Responsividade

### Breakpoints

- `>= 1280px`: dashboard com 5 KPIs por linha
- `<= 1320px`: ajuste de grids
- `<= 1060px`: redução de densidade
- `<= 768px`: sidebar vira drawer mobile
- `<= 480px`: padding reduzido e empilhamento de ações

### Sidebar mobile

Em `<= 768px`:

- sidebar sai do fluxo principal;
- entra como painel lateral;
- topbar mobile exibe botão hambúrguer;
- overlay fecha ao clicar fora ou navegar.

### Tabelas em mobile

Toda tabela deve estar dentro de `.table-shell { overflow-x: auto; }` para
permitir scroll interno sem quebrar o layout da página.

## Acessibilidade obrigatória

- botões com `title` em português;
- modais com `role="dialog"`;
- drawers com `role="complementary"`;
- `Escape` fecha modal e drawer;
- `feedback.error` usa `role="alert"`;
- `feedback.success` e loaders usam `role="status"`;
- headers de tabela usam `scope="col"`;
- modais e drawers precisam controlar foco.
