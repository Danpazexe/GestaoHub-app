# Guia de Padronização - Gestão Hub

Este documento define as regras arquiteturais, de design e de desenvolvimento para manter a consistência em todo o ecossistema do aplicativo **Gestão Hub** (`v0.0.31`). Qualquer novo módulo, tela ou componente deve seguir fielmente as diretrizes aqui descritas.

---

## 1. Arquitetura de Pastas

O projeto segue uma estrutura baseada em funcionalidades (**Feature-Sliced**):

```
src/
├── features/
│   ├── auth/           # Autenticação (Entry, Login, Register)
│   │   └── screens/
│   ├── home/           # Tela inicial + Navegação de Módulos
│   │   └── screens/    # HomeScreen, ModuleFunctionsScreen, EasterEggScreen
│   ├── modules/        # Base genérica para módulos futuros (placeholder)
│   │   └── screens/    # ModuleBaseScreen
│   ├── validade/       # Módulo de Controle de Validade (ATIVO)
│   │   ├── screens/    # ListScreen, AddProductScreen, DashboardScreen, TratarScreen, ExcelScreen, BarcodeScannerScreen
│   │   └── components/ # ProductItem, SwipeableListItem, SwipeableHistoryItem, TreatmentModal, DeleteConfirmationModal
│   ├── avaria/         # Módulo de Avarias (ATIVO)
│   │   ├── screens/    # AvariaListScreen, AvariaEntryScreen, AvariaResolutionScreen, AvariaHistoryScreen, AvariaDashboardScreen
│   │   ├── components/ # (vazio – componentes inline por enquanto)
│   │   └── constants/  # DAMAGE_TYPES, BONUS_TYPES, RESOLUTION_TYPES
│   ├── pdf/            # Geração e visualização de PDFs
│   │   └── screens/    # PdfScreen, PdfViewerScreen + pdfTemplate.html
│   ├── sql/            # Consulta ao banco de dados local/cache
│   │   ├── screens/    # SqlScreen
│   │   └── constants/  # schemas.js (DATABASE_TABLES)
│   ├── profile/        # Perfil do usuário
│   │   └── screens/    # ProfileScreen
│   ├── settings/       # Configurações do app
│   │   └── screens/    # SettingsScreen
│   └── notification/   # Gerenciamento de notificações
│       └── screens/    # NotificationScreen
├── shared/
│   ├── components/     # Componentes universais
│   │   ├── ScreenLayout.js     # Engine de renderização de telas
│   │   ├── HeaderMenu.js       # Menu de contexto padronizado
│   │   ├── coresAuth.js        # Design Tokens (TODAS as cores)
│   │   └── toastConfig.js      # Configuração visual dos Toasts
│   ├── constants/
│   │   └── storage.js          # Chaves centralizadas do AsyncStorage
│   └── utils/
│       └── systemBars.js       # Mapeamento StatusBar/NavigationBar por rota
```

### Regras de Organização:
- **Screens**: Cada tela vive dentro de `features/[modulo]/screens/`.
- **Components**: Componentes exclusivos de um módulo ficam em `features/[modulo]/components/`. Componentes universais ficam em `shared/components/`.
- **Constants**: Enums, schemas e tipagens ficam em `features/[modulo]/constants/`. Constantes globais ficam em `shared/constants/`.
- **Nunca** colocar lógica de negócio ou estilos específicos de um módulo dentro de `shared/`.

---

## 2. Stack Tecnológico

| Camada           | Tecnologia                                          |
|------------------|-----------------------------------------------------|
| Framework        | React Native `0.74.5` (CLI, **sem Expo**)            |
| Navegação        | `@react-navigation/stack` v6                         |
| Estado           | `useState` / `useCallback` / `useMemo` (sem Redux)  |
| Persistência     | `AsyncStorage` (dados locais)                        |
| Backend          | Supabase (`@supabase/supabase-js`)                   |
| UI Kit           | `react-native-paper` (Menus, Dialogs)                |
| Ícones           | `MaterialIcons` + `MaterialCommunityIcons`           |
| Gráficos         | `react-native-chart-kit` + `react-native-svg`       |
| PDF              | `react-native-html-to-pdf` + `react-native-pdf`     |
| Excel            | `xlsx` + `react-native-blob-util`                    |
| Notificações     | `@notifee/react-native`                              |
| Scanner          | `react-native-vision-camera`                         |
| Feedback Tátil   | `react-native-haptic-feedback`                       |
| Animações        | `react-native-animatable` + `Animated` (built-in)   |

---

## 3. Navegação e App.js

### Navegador Principal
O app usa um **único `Stack.Navigator`** no `App.js`, sem Tab ou Drawer. Toda a navegação é feita via `navigation.navigate('NomeDaTela')`.

### Padrão de Registro de Tela
Toda nova tela **deve ser registrada** em 3 lugares:

1. **`App.js`**: Importar e adicionar como `<Stack.Screen>`.
   - Passar `isDarkMode` como prop: `{props => <NovaTela {...props} isDarkMode={isDarkMode} />}`
2. **`systemBars.js`**: Registrar a cor do header nos objetos `LIGHT_ROUTE_HEADER_COLORS` e `DARK_ROUTE_HEADER_COLORS`.
3. **`coresAuth.js`**: Criar o objeto de tema da tela (`CORESNOME`).

### Passagem de Dark Mode
O `isDarkMode` é resolvido no `App.js` via `Appearance.getColorScheme()` e passado como **prop** para cada tela. Não existe contexto global de tema — cada tela recebe `isDarkMode` diretamente.

### Transição entre Telas
O app utiliza `TransitionPresets.SlideFromRightIOS` com uma `transitionSpec` customizada para transições suaves e consistentes entre todas as telas.

### Módulos Futuros (Placeholder)
Módulos como **Conferência**, **Inventário**, **Pedidos** e **Auditoria** já possuem entradas no `HomeScreen.js` mas apontam para `ModuleBaseScreen`, que exibe uma tela placeholder com bullets descritivos. Quando forem implementados, devem seguir o mesmo padrão dos módulos Validade e Avaria.

---

## 4. Sistema de Dados e Constantes

**Regra de Ouro**: Nenhuma string de chave do `AsyncStorage` ou ID de tipo deve ser "hardcoded".

### Chaves de Armazenamento (Storage Keys)
- Todas as chaves do `AsyncStorage` devem ser registradas em `src/shared/constants/storage.js`.
- Chaves atuais:
  - **Validade**: `products`, `lastExportDate`, `lastImportDate`, `addProduct_lookupFromSql`
  - **Avaria**: `avaria_batches`
  - **SQL**: `cached_products`, `sql_search_history`

### Tabelas e Schemas (SQL)
- Definições de campos, labels e ícones das "tabelas" residem em `src/features/sql/constants/schemas.js`.
- Cada tabela no schema deve ter: `id`, `label`, `icon`, `primaryKey`, `fields[]`, e uma função `normalize()`.
- Telas que exibem listagens SQL devem ser dinâmicas, iterando sobre o schema definido.

### Constantes de Módulo
- Enums e tipagens de negócio (ex: `DAMAGE_TYPES`, `BONUS_TYPES`, `RESOLUTION_TYPES`) ficam em `features/[modulo]/constants/index.js`.
- Nunca "hardcodar" labels ou ícones diretamente no componente.

---

## 5. Sistema de Cores (Design Tokens)

**Regra de Ouro**: Nunca use cores "hardcoded" nos componentes. Utilize o arquivo `src/shared/components/coresAuth.js`.

### 5.1 Anatomia de um Objeto de Tema

Para cada nova funcionalidade ou tela, crie um objeto exportado seguindo este modelo:

```javascript
export const CORESNOMEDATELA = {
  // Identidade
  primary: '#XXXXXX',       // Cor principal (header, botão principal)
  secondary: '#XXXXXX',     // Variante mais escura
  accent: '#XXXXXX',        // Destaque auxiliar

  // Fundos
  background: '#f4f6fb',    // Fundo Light
  backgroundDark: '#181818', // Fundo Dark (#181818 ou #1f2438)

  // Componentes
  card: '#ffffff',           // Card Light
  cardDark: '#262d47',       // Card Dark (SEMPRE #262d47)
  inputDark: '#2b3350',      // Input/Campo Dark (SEMPRE #2b3350)

  // Bordas
  border: 'rgba(X, X, X, 0.22)', // Borda Light (com opacidade)
  borderDark: '#3a4265',          // Borda Dark (SEMPRE #3a4265)

  // Tipografia
  text: '#2e3554',           // Texto Light
  textDark: '#f3f5ff',       // Texto Dark (SEMPRE #f3f5ff)
  textMuted: '#666666',      // Texto secundário Light
  textMutedDark: '#aab1cf',  // Texto secundário Dark (SEMPRE #aab1cf)

  // Auxiliares
  white: '#ffffff',
};
```

### 5.2 Paleta Dark Mode Unificada

| Token            | Valor Hex  | Uso                                |
|------------------|------------|------------------------------------|
| `backgroundDark` | `#181818` / `#1f2438`  | Fundo padrão (`#181818`) ou Avaria/Home (`#1f2438`)    |
| `cardDark`       | `#262d47`  | Cards, modais, containers elevados |
| `inputDark`      | `#2b3350`  | Campos de input/text em dark       |
| `borderDark`     | `#3a4265`  | Bordas de cards e separadores      |
| `textDark`       | `#f3f5ff`  | Texto primário                     |
| `textMutedDark`  | `#aab1cf`  | Texto secundário/labels            |

> **⚠️ Estes valores são padrão, mas módulos específicos (Home, Avaria) usam variações de fundo (`#1f2438`).** O "clima" dark deve ser consistente dentro do módulo.

### 5.3 Vínculo Funcional

No objeto `CORESFUNCIONALIDADES.actions`, aponte a chave da tela para o `primary` do seu tema:
```javascript
'nome-da-acao': CORESNOMEDATELA.primary
```

### 5.4 Consumo no Componente

```javascript
import { CORESNOMEDATELA } from '../../../shared/components/coresAuth';
const COLORS = CORESNOMEDATELA;

// ✅ Correto
backgroundColor: COLORS.cardDark

// ❌ Errado
backgroundColor: '#262d47'
```

### 5.5 Por que cada tela tem uma cor?
- **Identidade Visual Única**: Facilita a memorização muscular do usuário.
- **Contraste e Navegação**: Evita monotonia visual e melhora a percepção de mudança de contexto.
- **Manutenção**: Permite trocar o "clima" de um módulo inteiro alterando um único arquivo central.

---

## 6. ScreenLayout — Engine de Renderização

O componente `ScreenLayout` é o wrapper padrão para TODAS as telas com conteúdo (exceção: telas fullscreen como Login, Entry, Scanner).

### Uso Obrigatório:
```jsx
<ScreenLayout
  isDarkMode={isDarkMode}
  lightBackground={COLORS.background}
  darkBackground={COLORS.backgroundDark}
  contentStyle={styles.container}
>
  {/* conteúdo */}
</ScreenLayout>
```

### Defaults Globais:
- `lightBackground`: `'#ffffff'`
- `darkBackground`: `'#181818'`
- `darkHeaderColor`: `'#181818'`

### Templates de Header

O `ScreenLayout` exporta 3 helpers para configurar o header via `navigation.setOptions()`:

| Helper                         | Uso                                           |
|--------------------------------|-----------------------------------------------|
| `createScreenHeaderTemplate()` | Configura cores, sombra, tipografia do header  |
| `createHeaderTitleTemplate()`  | Renderiza título + subtítulo + ícone           |
| `createHeaderActionsTemplate()`| Renderiza botões de ação no header (direita)   |

### Exemplo Completo de Header:
```javascript
useLayoutEffect(() => {
  navigation.setOptions({
    ...createScreenHeaderTemplate({
      isDarkMode,
      lightHeaderColor: COLORS.primary,
      darkHeaderColor: COLORS.primary,
      tintColor: '#FFFFFF',
    }),
    headerTitle: () =>
      createHeaderTitleTemplate({
        title: 'Nome da Tela',
        subtitle: 'Descrição curta',
        iconName: 'nome-do-icone',
        tintColor: '#FFFFFF',
      }),
    headerRight: () =>
      createHeaderActionsTemplate({
        isDarkMode,
        actions: [
          { key: 'action1', iconName: 'refresh', onPress: handleRefresh },
        ],
      }),
  });
}, [navigation, isDarkMode]);
```

---

## 7. Padronização de Interface (UX/UI)

### 7.1 Header (Cabeçalho)
- **Layout**: Sempre utilizar `ScreenLayout` + templates para garantir consistência.
- **Título**: Composto por ícone (opcional) + título + subtítulo. Alinhamento à esquerda.
- **Botões de Ação**: **Quadrados** (`borderRadius: 8`) com fundo semi-transparente `rgba(255, 255, 255, 0.22)`.
- **Overflow Menu**: Ações secundárias devem ser agrupadas no menu de 3 pontos (`more-vert`) usando o componente `HeaderMenu`.

### 7.2 Barra de Status e Navegação (System Bars)
- **Sincronização**: A `StatusBar` e a `NavigationBar` acompanham a cor do header da tela.
- **Registro Obrigatório**: Toda nova tela deve ser registrada em `systemBars.js` nos objetos `LIGHT_ROUTE_HEADER_COLORS` e `DARK_ROUTE_HEADER_COLORS`.
- A função `getRouteHeaderBackground()` resolve a cor correta com base na rota e no modo dark/light.
- Telas especiais como `HomeScreen` e `BarcodeScannerScreen` possuem tratamento específico (transparent, translucent).

### 7.3 Toast Notifications
- O app usa um sistema customizado de Toasts (`toastConfig.js`) com:
  - 3 tipos: `success`, `error`, `info`
  - Ícones animados por tipo (bounce para error, 360° spin para success, pulso para info)
  - Fundo colorido com sombra e `borderRadius: 16`
- **Usar**: `Toast.show({ type: 'success', text1: 'Título', text2: 'Detalhe' })`
- **Nunca** usar `Alert.alert()` para feedbacks simples — reservar apenas para confirmações destrutivas.

### 7.4 Estilos Dark Mode nos Componentes
O padrão de aplicação de dark mode nos estilos é **condicional no JSX**:
```jsx
<View style={[styles.card, isDarkMode && styles.darkCard]}>
```

Quando há muitos estilos dependentes de tema, usar **funções geradoras**:
```javascript
const getStyles = (isDarkMode) => StyleSheet.create({
  container: {
    backgroundColor: isDarkMode ? COLORS.backgroundDark : COLORS.background,
  },
});
```

### 7.5 Componentes Reutilizáveis

| Componente         | Localização          | Função                                               |
|--------------------|----------------------|------------------------------------------------------|
| `ScreenLayout`     | `shared/components/` | SafeArea + fundo adaptativo + templates de header    |
| `HeaderMenu`       | `shared/components/` | Menu overflow de 3 pontos uniformizado               |
| `toastConfig`      | `shared/components/` | Toasts animados e visuais premium                    |
| `ProductItem`      | `validade/components/`| Card de produto com badge de validade                |
| `SwipeableListItem` | `validade/components/`| Item com swipe para ações (tratativa, excluir)      |
| `TreatmentModal`   | `validade/components/`| Modal de tratativa com opções de destino            |
| `DeleteConfirmationModal` | `validade/components/`| Confirmação de exclusão com animação          |

---

## 8. Módulos do App

### 8.1 Validade (ATIVO — Completo)
Controle de validade de produtos com ciclo completo:
- **ListScreen**: Listagem principal com busca, filtros e swipe actions
- **AddProductScreen**: Cadastro via formulário ou scanner de código de barras
- **DashboardScreen**: Gráficos e estatísticas com filtros de período e escopo. Exportação para PDF/CSV/JSON
- **TratarScreen**: Tratativas (vendido, trocado, devolvido) com status e filtros. Exportação para PDF
- **ExcelScreen**: Importação e exportação de planilhas Excel (`.xlsx`)
- **BarcodeScannerScreen**: Scanner de código de barras com overlay customizado

### 8.2 Avaria (ATIVO — Completo)
Gestão de avarias com fluxo em lotes:
- **AvariaEntryScreen**: Lançamento de itens avariados com tipo de dano e bônus
- **AvariaListScreen**: Listagem de lotes abertos com resumos
- **AvariaResolutionScreen**: Resolução por item (descarte, devolução, doação, venda c/ desconto)
- **AvariaHistoryScreen**: Histórico de lotes concluídos
- **AvariaDashboardScreen**: Dashboard com estatísticas e filtro por período

### 8.3 Módulos Futuros (Placeholder via ModuleBaseScreen)
- **Conferência**: Recebimento, Saída, Divergências
- **Inventário**: Contagem Cíclica, Recontagem, Ajustes
- **Pedidos e Carga**: Separação, Conferência de Carga, Roteirização
- **Auditoria de Preço**: Emissão de Etiquetas, Divergências de Preço, Histórico
- **Requisições**: Consumo Interno, Pedidos Entre Lojas, Aprovações

### 8.4 Utilidades (ATIVO)
- **SqlScreen**: Consulta ao banco de dados local (cache de produtos). Busca por código, nome ou EAN
- **PdfScreen / PdfViewerScreen**: Geração e visualização de relatórios em PDF
- **ProfileScreen**: Edição de perfil do usuário (nome, email, senha, foto)
- **SettingsScreen**: Configurações (dark mode, biometria, backup automático, reset de dados)
- **NotificationScreen**: Gerenciamento e agendamento de notificações de validade

---

## 9. HomeScreen — Hub de Navegação

A `HomeScreen.js` é o centro do app. Ela define a **estrutura de módulos e ações** como um array `moduleCards`, onde cada módulo contém:

```javascript
{
  id: 'modulo',
  title: "TÍTULO",
  subtitle: "Descrição curta",
  icon: "icone-material",
  color: CORESFUNCIONALIDADES.modules.modulo,
  actions: [
    {
      id: 'modulo-acao',
      title: 'Nome da Ação',
      icon: 'icone',
      screen: 'NomeDaTelaScreen',
      color: CORESFUNCIONALIDADES.actions['modulo-acao'],
    },
  ],
}
```

### Regras:
- A cor do módulo vem de `CORESFUNCIONALIDADES.modules`.
- A cor de cada ação vem de `CORESFUNCIONALIDADES.actions`.
- Para módulos ainda não implementados, usar `screen: 'ModuleBaseScreen'` com `routeParams` descritivos.
- A HomeScreen possui header customizado sem usar `ScreenLayout` (layout próprio com gradiente).

---

## 10. Fluxo de Interação

- **Toasts**: Para feedbacks rápidos (sucesso, erro, informação). Sempre usar `Toast.show()`.
- **Alerts**: Apenas para confirmações destrutivas (excluir, resetar dados). Usar `Alert.alert()`.
- **Modais**: Usar `Modal` do React Native para fluxos complexos que exigem interação (ex: `TreatmentModal`). Usar `Dialog` do `react-native-paper` para seleções simples.
- **Menus**: Ações secundárias devem ser agrupadas no `HeaderMenu` de 3 pontos. Evitar criar telas extras de "ajustes" para opções simples.
- **Haptic Feedback**: Utilizar em ações importantes (ex: scanner, confirmações) via `react-native-haptic-feedback`.

---

## 11. Convenções de Código

### Nomes de Arquivos
- **Screens**: PascalCase com sufixo `Screen` (ex: `AddProductScreen.js`)
- **Components**: PascalCase (ex: `ProductItem.js`, `SwipeableListItem.js`)
- **Constants**: camelCase ou UPPER_CASE (ex: `storage.js`, `DAMAGE_TYPES`)

### Nomes de Variáveis
- **Objetos de Cores**: `CORESNOMEDATELA` (ex: `CORESAVARIAENTRY`, `CORESLIST`)
- **Alias local**: `const COLORS = CORESxxxxxx;` — sempre usar `COLORS` como alias do tema importado
- **Nomes funcionais**: Em português dentro das constantes de cores para facilitar o entendimento do negócio (ex: `fundoDark`, `textoPrincipal`)

### Estilos
- Usar `StyleSheet.create` para estilos estáticos.
- Para estilos dependentes de tema: usar `isDarkMode && styles.darkVariant` no JSX, ou `getStyles(isDarkMode)` para telas complexas.
- **Nunca** usar `style={{ backgroundColor: '#262d47' }}` inline com valores hardcoded — sempre referenciar tokens.

### Imports
- Componentes shared: caminho relativo a partir de `../../../shared/components/`
- Constantes de cores: `import { CORESNOME } from '../../../shared/components/coresAuth'`
- Storage keys: `import { STORAGE_KEYS } from '../../../shared/constants/storage'`

---

## 12. Checklist para Nova Tela

Ao criar uma nova tela, siga esta checklist:

- [ ] Criar o objeto de tema em `coresAuth.js` (seguir padrão da Seção 5.1)
- [ ] Registrar a cor da ação em `CORESFUNCIONALIDADES.actions`
- [ ] Criar o arquivo em `src/features/[modulo]/screens/NomeDaTela.js`
- [ ] Wrappear com `ScreenLayout` e usar `createScreenHeaderTemplate`
- [ ] Registrar a `<Stack.Screen>` no `App.js`
- [ ] Registrar as cores em `systemBars.js` (light e dark)
- [ ] Adicionar a entrada no array `moduleCards` do `HomeScreen.js` (ou no módulo existente)
- [ ] Registrar chaves de storage em `storage.js` (se aplicável)
- [ ] Testar dark mode e light mode
- [ ] Verificar que **nenhuma cor está hardcoded** — todos os valores vêm de `COLORS.xxx`

---

*Última atualização: 12 de Fevereiro de 2026*
*Este documento deve ser atualizado sempre que um novo padrão global for estabelecido.*
