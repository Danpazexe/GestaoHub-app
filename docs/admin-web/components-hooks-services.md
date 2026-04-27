# Componentes, Hooks e Serviços

## Componentes novos

### `ConfirmModal`
- portal em `document.body`;
- overlay com blur;
- fecha com `Escape` e clique fora;
- foco inicial no cancelar;
- suporta ação destrutiva via `danger`.

### `Drawer`
- painel lateral fixo;
- overlay clicável;
- header fixo;
- rolagem interna;
- `100vw` em telas pequenas.

### `SearchInput`
- debounce interno;
- ícone de lupa;
- botão de limpar.

### `SelectFilter`
- select nativo estilizado;
- consistente com o design system;
- sem bibliotecas externas.

## Hook `useConfirm`

### Uso esperado

```js
const { confirm, ConfirmModalNode } = useConfirm();
```

### Responsabilidade
- abrir confirmação imperativa;
- devolver `Promise<boolean>`;
- centralizar o `ConfirmModal` para qualquer view.

## Hook `useTableFilter`

### Responsabilidade
- busca textual;
- filtro por select;
- paginação;
- reset de página quando busca ou filtro mudarem.

### Retorno esperado
- `filtered`
- `total`
- `search`
- `setSearch`
- `filterValue`
- `setFilterValue`
- `page`
- `setPage`
- `pageCount`

## `adminApi`

### Métodos já existentes
- `signIn`
- `signOut`
- `getDashboardSummary`
- `getActiveUsers`
- `getTratativas`
- `getValidade`
- `getAvarias`
- `getConferenciaRecebimentos`
- `getConferenciaSaidas`
- `getConferenciaBonusQueue`
- `getEvents`
- `importConferenciaBonusFromXml`

### Métodos a sustentar para CRUD operacional
- `updateTratativa`
- `getTratativaById`
- `resolveAvariaItem`
- `deleteAvariaItem`
- `applyValidadeTreatment`
- `resolveValidadeItem`
- `assignConferenciaBonus`
- `removeConferenciaBonus`
- `forceSignOut`
- `getUserEvents`

### Regras obrigatórias
- usar Supabase centralizado;
- lançar erro em português;
- não retornar `{ data, error }`;
- manter assinatura `async/await`.

## `lib/csv.js`

### Objetivo
- exportar dados filtrados para CSV compatível com Excel brasileiro.

### Regras
- separador `;`;
- codificação UTF-8 com BOM;
- download via `Blob` e `URL.createObjectURL`;
- nome final com timestamp.

## `lib/toast.js`

### Objetivo
- encapsular `react-hot-toast`;
- padronizar fonte, borda, superfície e duração;
- manter chamadas simples:
  - `toast.success`
  - `toast.error`
  - `toast.loading`
  - `toast.dismiss`

## Padrão de ação assíncrona em view

```js
const [loading, setLoading] = useState(false);

const handleAcao = async () => {
  setLoading(true);
  const toastId = toast.loading('Processando...');
  try {
    await adminApi.algumMetodo();
    toast.success('Ação concluída');
  } catch (err) {
    toast.error(err.message || 'Erro ao processar ação.');
  } finally {
    setLoading(false);
    toast.dismiss(toastId);
  }
};
```

## Restrições de qualidade

Proibido neste painel:

- `fetch` direto em componentes;
- `window.confirm` e `alert`;
- `console.log` em produção;
- bibliotecas extras de UI;
- cores hardcoded fora dos tokens;
- manipulação manual de DOM para controlar estados da interface.
