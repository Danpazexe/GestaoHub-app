# Padrão Visual

## Shell obrigatório
- `ScreenLayout` é a base visual das telas canônicas.
- headers usam `createScreenHeaderTemplate`, `createHeaderTitleTemplate` e `createHeaderActionsTemplate`.
- a estrutura deve ser consistente entre módulos, mesmo preservando paletas diferentes por domínio.

## Sistema visual
- fundo claro neutro ou fundo escuro controlado por domínio.
- cartões com hierarquia clara e borda/sombra controlada.
- blocos de resumo compactos no topo para módulos analíticos.
- filtros em pills ou chips, não em barras confusas ou modais improvisados.
- formulários longos divididos em seções lógicas.

## Estados
- toda tela de dados deve prever, quando fizer sentido:
  `loading`, `empty`, `error`, `success`.
- estados vazios devem manter CTA e orientação operacional.
- ações destrutivas ficam separadas visualmente das ações de consulta e exportação.

## Cores
- a paleta permanece por domínio.
- o padrão global é de sistema, não de cor única.
- `coresAuth.js` ainda centraliza muito tema legado; módulos novos podem complementar com tokens locais no domínio.

## Documentos
- HTML/PDF compartilham a mesma estrutura de informação da tela nativa.
- branding segue Gestão Hub.
- o documento precisa ser idempotente para o mesmo snapshot de dados.
