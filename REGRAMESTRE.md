# Guia de Padronização - Gestão Hub

Este documento define as regras arquiteturais, de design e de desenvolvimento para manter a consistência em todo o ecossistema do aplicativo.

## 1. Arquitetura de Pastas
O projeto segue uma estrutura baseada em funcionalidades (**Features**):

- `src/features/[modulo]`: Agrupa tudo relacionado a uma funcionalidade específica (Ex: Validade, Avaria).
    - `/screens`: Telas principais do módulo.
    - `/components`: Componentes exclusivos daquele módulo.
- `src/shared`: Código compartilhado por todo o app.
    - `/components`: Componentes universais (`ScreenLayout`, `HeaderMenu`, `coresAuth.js`).
    - `/utils`: Funções utilitárias e helpers (`systemBars.js`).
- `assets`: Outros recursos estáticos (imagens, fontes).

## 2. Sistema de Cores (Design Tokens)
**Regra de Ouro**: Nunca use cores "hardcoded". Utilize o arquivo `src/shared/components/coresAuth.js`.

- **CORESFUNCIONALIDADES**: Mapeia cada módulo e ação a uma cor específica.
- **Hierarquia**:
    - `Primary`: Cor do header e botões de ação principal.
    - `Card`: Cor de fundo dos cards (Light/Dark mode).
- **Ações**: Cada subtela de um módulo deve ter uma cor distinta definida no objeto `actions` para facilitar a navegação visual.

## 3. Padronização de Interface (UX/UI)

### Header (Cabeçalho)
- **Layout**: Utilizar o `ScreenLayout` para garantir consistência em SafeAreas.
- **Botões de Ação**: Devem ser **Quadrados** (`borderRadius: 8`) com fundo semi-transparente `rgba(255, 255, 255, 0.22)`.
- **Overflow Menu**: Ações secundárias devem ser agrupadas em um menu de 3 pontos (`more-vert`) utilizando o componente compartilhado `HeaderMenu`.

### Barra de Status e Navegação (System Bars)
- **Sincronização**: A cor da `StatusBar` e da `NavigationBar` deve sempre acompanhar a cor do Header da tela.
- **Registro Obrigatório**: Toda nova tela deve ser registrada no arquivo `src/shared/utils/systemBars.js` nos objetos `LIGHT_ROUTE_HEADER_COLORS` e `DARK_ROUTE_HEADER_COLORS`. Isso garante que o sistema identifique a cor correta automaticamente.

### Componentes Reutilizáveis
- `ScreenLayout`: Engine de renderização de telas com suporte a Dark Mode e templates de Header.
- `HeaderMenu`: Abstração do `react-native-paper` para menus de contexto uniformes.
- `CustomStatusBar`: Gerenciamento dinâmico da barra de status conforme a cor da tela.

## 4. Fluxo de Interação
- **Modais**: Evitar modais personalizados para seleções simples. Utilizar `Dialog` da `react-native-paper` para seleções complexas e `Toast` para feedbacks rápidos.
- **Configurações**: Chaves de ligar/desligar devem ser integradas diretamente ao `Menu` de 3 pontos quando possível, evitando a criação de telas extras de "ajustes" para opções simples.

## 5. Convenções de Código
- **Componentes**: CamelCase (Ex: `AddProductScreen.js`).
- **Nomes Funcionais**: Em português dentro das constantes de cores para facilitar o entendimento do negócio.
- **Estilos**: Preferir `StyleSheet.create` e, quando dependente de tema, utilizar funções geradoras (Ex: `getStyles(isDarkMode)`).

---
*Este documento deve ser atualizado sempre que um novo padrão global for estabelecido.*
