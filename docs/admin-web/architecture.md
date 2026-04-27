# Arquitetura do Painel

## Estrutura de pastas alvo

```text
GestaoHub-web/
├── index.html
├── vite.config.js
├── package.json
└── src/
    ├── App.jsx
    ├── styles.css
    ├── components/
    │   ├── AdminShell.jsx
    │   ├── AppIcon.jsx
    │   ├── ConfirmModal.jsx
    │   ├── DataTable.jsx
    │   ├── Drawer.jsx
    │   ├── LoginForm.jsx
    │   ├── MetricCard.jsx
    │   ├── PanelSection.jsx
    │   ├── SearchInput.jsx
    │   ├── SelectFilter.jsx
    │   └── StatusBadge.jsx
    ├── config/
    │   └── navigation.js
    ├── features/
    │   ├── dashboard/
    │   ├── overview/
    │   ├── users/
    │   ├── tratativas/
    │   ├── conferencia/
    │   ├── avarias/
    │   ├── validade/
    │   └── events/
    ├── hooks/
    │   ├── useAdminSession.js
    │   ├── useConfirm.js
    │   └── useTableFilter.js
    ├── lib/
    │   ├── format.js
    │   ├── csv.js
    │   └── toast.js
    └── services/
        └── adminApi.js
```

## Regras de organização

- features devem continuar separadas por domínio;
- componentes transversais ficam em `src/components`;
- serviços de acesso ao Supabase ficam centralizados em `src/services`;
- `src/lib` abriga utilitários puros;
- `styles.css` permanece como folha global única, estendida sem fragmentar o padrão visual.

## Shell do painel

O shell base é composto por:

- `AdminShell` como estrutura principal;
- sidebar com navegação por grupos;
- topbar com status, atualização e ações de sessão;
- área de conteúdo delegada à view ativa.

## Navegação

O grupo `general` deve começar por `dashboard`, seguido das views mais
analíticas. O grupo `operation` concentra os módulos operacionais.

Exemplo de entrada nova em `navigation.js`:

```js
{ key: 'dashboard', label: 'Dashboard', shortLabel: 'DB', icon: 'dashboard' }
```

## Papel do `App.jsx`

`App.jsx` deve:

- carregar sessão;
- buscar dados globais;
- manter o `selectedView`;
- resolver o mapa de views;
- renderizar `Toaster`, shell e feedback global.

## Regras de implementação

- ações assíncronas passam por `adminApi`;
- feedbacks em UI via `toast`;
- confirmações sempre via `useConfirm` + `ConfirmModal`;
- detalhes e payloads extensos via `Drawer`;
- filtros, busca e paginação seguem o contrato de `useTableFilter`.

## Estado global e carregamento

O painel não deve depender de bibliotecas extras de cache. O padrão aprovado é:

- `useState` para estado local;
- `useEffect` para carregamento;
- `useMemo` para agregações, gráficos e listas derivadas;
- `useCallback` para handlers passados a filhos.

## Integração com Supabase

Todo método de `adminApi` deve:

- usar `src/lib/supabase.js`;
- ser `async`;
- lançar erro em português;
- retornar dados já limpos do contrato Supabase.

## Relação com o mobile

O painel só funciona plenamente quando o app móvel publica:

- presença e heartbeat;
- eventos operacionais;
- conferências e divergências;
- fila de bônus e seus itens;
- status final da execução em campo.
