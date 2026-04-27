# Entrega e Validação

## Arquivos novos previstos pelo briefing

```text
src/components/ConfirmModal.jsx
src/components/Drawer.jsx
src/components/SearchInput.jsx
src/components/SelectFilter.jsx
src/features/dashboard/DashboardView.jsx
src/hooks/useConfirm.js
src/hooks/useTableFilter.js
src/lib/csv.js
src/lib/toast.js
```

## Arquivos que o plano prevê ajustar

```text
src/styles.css
src/App.jsx
src/config/navigation.js
src/components/AppIcon.jsx
src/components/DataTable.jsx
src/features/overview/OverviewView.jsx
src/features/users/UsersView.jsx
src/features/tratativas/TratativasView.jsx
src/features/conferencia/ConferenciaView.jsx
src/features/avarias/AvariasView.jsx
src/features/validade/ValidadeView.jsx
src/features/events/EventsView.jsx
src/services/adminApi.js
```

## Checklist funcional

- dashboard renderiza com dados vazios;
- gráficos não quebram sem dados;
- ações críticas passam por confirmação;
- feedback de sucesso e erro aparece em português;
- filtros, busca e paginação funcionam;
- exportações CSV geram BOM e `;`;
- drawer abre e fecha corretamente;
- modal fecha com `Escape` e overlay.

## Checklist de build

- `npm install` sem erro;
- `npm run build` sem erro;
- imports resolvidos corretamente.

## Checklist de responsividade

- sidebar vira drawer em `<= 768px`;
- tabelas têm scroll horizontal em mobile;
- dashboard responde aos breakpoints;
- modal e drawer ocupam `100vw` em telas pequenas.

## Checklist de acessibilidade

- botões com `title`;
- modal com `role="dialog"`;
- drawer com `role="complementary"`;
- feedbacks com roles semânticos;
- headers de tabela com `scope="col"`.

## Comandos esperados

```bash
npm install recharts react-hot-toast
npm run build
npm run dev
```

## Observação operacional

O briefing original exige também um `CHANGES.md` na raiz do projeto ao final da
implementação do painel. Esse arquivo é parte da trilha de entrega do admin web
e deve ser mantido atualizado quando esse plano for executado no código.
