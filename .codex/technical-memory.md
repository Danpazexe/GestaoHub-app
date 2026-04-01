# Memória Técnica

## Decisões Atuais
- `docs/*` e `.codex/skills/gestao-mobile-standards/*` são a fonte de verdade do padrão arquitetural e visual do app.
- `docs/repo-audit.md` é a referência canônica para leitura global da pasta `Gestao` e revisão manual da estrutura do projeto.
- O padrão canônico é `src/features/<dominio>/{components,constants,mappers,screens,services,storage}`.
- Rotas públicas podem continuar usando nomes antigos, mas o ponto de entrada canônico deve existir em `src/features/*`.
- Telas migradas não acessam `AsyncStorage` diretamente; persistência e sync passam por `services` e `storage` do domínio.
- `ScreenLayout` e os helpers de header são o shell padrão das telas canônicas.
- `src/theme/*` é a fonte de verdade dos tokens visuais; `src/components/coresAuth.js` existe apenas como bridge temporária de compatibilidade.
- Templates HTML/PDF canônicos vivem em `src/assets/templates/*`; platform folders não devem manter cópias manuais divergentes.
- Telas internas e diagnósticas ficam em `src/internal/*` e não entram no fluxo público em produção.
- Tratativas de recebimento usam títulos curtos no header para não colidir com ícone e ações do topo.
- `Motivos` usam seleção múltipla com `Portal` + `Modal`, e não mais `Picker` com rolagem.
- O desfecho de recebimento é limitado a `devolucao`, `troca`, `tratativa` e `descarte`.
- O modelo de recebimento usa `occurrence_type` separado de `resolution_type`, com suporte a `avaria`, `falta` e `outro`.
- A numeração do espelho é gerada no primeiro salvamento e segue o padrão `TR {supplier_code} - {NNNN}` por fornecedor.
- A foto do produto é obrigatória apenas para ocorrências de `avaria`.
- `handling_methods` e `handling_method` permanecem somente para compatibilidade de leitura remota/cache; o app não usa mais esses campos no fluxo de recebimento.
- Toda mudança feita por Codex deve atualizar este arquivo no mesmo patch.

## Histórico

### 2026-03-31 22:34:00 -0300
- Objetivo: corrigir a cor da status bar/header em rotas de conferência que estavam caindo no fallback claro por falta de mapeamento em `systemBars`.
- Telas e serviços afetados: `src/utils/systemBars.js`, memória técnica.
- Mudanças de comportamento:
  - `ConferenciaRecebimentoScreen`, `ConferenciaSaidaScreen` e `ConferenciaDivergenciasScreen` passam a aplicar a mesma cor do header também na status bar do Android;
  - as rotas de conferência deixam de exibir barra branca no topo quando a tela usa cabeçalho colorido.
- Mudanças de contrato/schema:
  - nenhuma em dados;
  - o mapa canônico de cores de system bars foi ampliado para cobrir todas as rotas públicas do módulo Conferência.
- Riscos pendentes:
  - outros módulos ainda podem precisar de revisão pontual se novas rotas forem adicionadas sem entrar nesse mapa central.

### 2026-03-31 22:26:00 -0300
- Objetivo: restaurar as cores do menu de ações do módulo Avaria após divergência introduzida na migração para o tema modular.
- Telas e serviços afetados: `src/theme/domains/avaria.js`, `src/theme/domains/home.js`, memória técnica.
- Mudanças de comportamento:
  - os cards de `Lançar avaria`, `Consultar avarias`, `Histórico` e `Dashboard de Avaria` voltam a seguir a paleta original do módulo;
  - o tema modular de Avaria foi realinhado para refletir as mesmas cores históricas usadas nas telas operacionais do domínio.
- Mudanças de contrato/schema:
  - nenhuma em dados;
  - o contrato visual do domínio `avaria` foi corrigido para manter compatibilidade com a identidade anterior do módulo.
- Riscos pendentes:
  - outros domínios ainda podem precisar de revisão fina de cor durante a migração do bridge `coresAuth.js` para `src/theme/*`.

### 2026-03-31 22:08:00 -0300
- Objetivo: executar a Fase 1 de fundação técnica, padronização e segurança, reduzindo acoplamento de telas, consolidando tema, endurecendo o build release e atualizando a documentação canônica.
- Telas e serviços afetados: `App.js`, `src/theme/*`, `src/components/ScreenLayout.js`, `src/components/coresAuth.js`, `src/features/recebimentoTratativas/screens/EspelhoRecebimentoScreen.js`, `src/features/recebimentoTratativas/components/TratativaFormFields.js`, `src/features/recebimentoTratativas/hooks/useTratativaValidation.js`, `src/features/validade/screens/{AddProductScreen,DashboardScreen,TratarScreen,PdfScreen}.js`, `src/features/validade/hooks/useLookupSqlPreference.js`, `src/features/validade/services/{dashboardFormatService,validadePreferencesService}.js`, `src/features/conferencia/screens/{ConferenciaRecebimentoScreen,ConferenciaSaidaScreen}.js`, `src/features/conferencia/components/{ConferenciaItemRow,ConferenciaBonusCard}.js`, `src/features/conferencia/hooks/{useConferenciaRecebimentoDrafts,useConferenciaSaidaDrafts}.js`, `src/features/home/screens/HomeScreen.js`, `src/features/sql/screens/SqlScreen.js`, `src/features/sql/services/sqlCacheService.js`, `src/services/userSessionStorageService.js`, `src/internal/screens/*`, `src/assets/templates/*`, `android/app/build.gradle`, `docs/*`, `.codex/skills/gestao-mobile-standards/references/*`.
- Mudanças de comportamento:
  - telas críticas começaram a ser quebradas em screen + components + hooks, com extração real de blocos de formulário, validação e renderização repetitiva;
  - `HomeScreen`, `DashboardScreen`, `AddProductScreen`, `TratarScreen`, `PdfScreen`, `ConferenciaRecebimentoScreen`, `ConferenciaSaidaScreen` e `SqlScreen` deixaram de usar `STORAGE_KEYS` diretamente no fluxo público;
  - `EasterEggScreen` e `ModuleBaseScreen` passaram a ser tratados como infraestrutura interna e só entram na navegação em `__DEV__`;
  - o shell visual passou a consumir tokens modulares de `src/theme/*` nos domínios migrados, reduzindo dependência direta do arquivo legado de cores;
  - a geração de PDF/HTML passou a depender da fonte canônica em `src/assets/templates/*`, sem cópia manual Android em paralelo;
  - o build release Android passou a exigir credenciais externas de assinatura e deixou de aceitar `debug.keystore` como fallback silencioso.
- Mudanças de contrato/schema:
  - não houve mudança de schema nesta fase;
  - o contrato visual interno passa a ser `src/theme/*` como API oficial de tokens;
  - a governança documental passa a reconhecer `src/assets/templates/*` como origem única dos templates e `src/internal/*` como namespace de telas não públicas;
  - foi adicionada documentação operacional para release signing, auditoria RLS e política de telas internas em `docs/security-and-release.md`.
- Riscos pendentes:
  - a quebra das telas gigantes foi iniciada, mas ainda não encerra toda a complexidade de `EspelhoRecebimentoScreen`, `AddProductScreen`, `DashboardScreen`, `ConferenciaRecebimentoScreen`, `SqlScreen` e `ListScreen`;
  - `coresAuth.js` continua existindo como bridge temporária e ainda precisa perder peso gradualmente;
  - o release signing foi validado com um keystore temporário externo ao repositório; falta configurar o keystore definitivo do projeto e o fluxo de CI/CD;
  - a auditoria RLS ficou documentada, mas ainda depende de execução operacional no ambiente Supabase do projeto.

### 2026-03-31 20:19:49 -0300
- Objetivo: criar uma auditoria global da pasta `Gestao`, cobrindo repositório, screens, camadas nativas, documentação e pontos de melhoria.
- Telas e serviços afetados: `docs/repo-audit.md`, `docs/README.md`, memória técnica.
- Mudanças de comportamento:
  - o projeto agora passa a ter um documento único para leitura global do repositório;
  - a auditoria cobre `src`, `android`, `ios`, `assets`, `supabase`, `docs`, `.codex` e os arquivos de configuração da raiz;
  - cada tela pública registrada em `App.js` passou a ter uma descrição funcional e um resumo de melhorias aparentes.
- Mudanças de contrato/schema:
  - nenhuma em dados;
  - a governança documental ganha `docs/repo-audit.md` como referência de revisão estrutural do projeto.
- Riscos pendentes:
  - a auditoria identificou inconsistência entre o código atual e `docs/architecture.md`, que ainda menciona `src/screens/*`;
  - `jsconfig.json` ainda mantém alias `@screens/*`, apesar da pasta não existir mais;
  - o relatório aponta dívidas prioritárias, mas não executa as correções estruturais por si só.

### 2026-03-31 06:51:16 -0300
- Objetivo: remover a pasta `src/screens` fisicamente e concentrar a implementação em `src/features`.
- Telas e serviços afetados: `App.js`, todos os entrypoints e auxiliares de `src/features`, remoção completa de `src/screens`.
- Mudanças de comportamento:
  - a implementação real de auth, home, módulos, pdf viewer, scanner, sql, validade, avaria, conferência e recebimento tratativas agora mora em `src/features`;
  - `src/screens` deixou de existir no repositório;
  - auxiliares de tela foram agrupados por domínio em `constants`, `hooks`, `mocks`, `services` e `templates` dentro das próprias features.
- Mudanças de contrato/schema:
  - nenhuma em dados;
  - o contrato arquitetural do app passa a ser efetivamente `src/features/<dominio>` como única origem canônica para telas e auxiliares de UI.
- Riscos pendentes:
  - os templates HTML preservados em `src/features/validade/templates` ainda coexistem com o asset Android usado em runtime para o PDF;
  - a refatoração não moveu `components`, `constants`, `services` e `utils` globais compartilhados, por escolha deliberada de escopo.

### 2026-03-31 01:38:57 -0300
- Objetivo: centralizar os pontos de entrada do app em `src/features`, reduzindo a dependência direta de `src/screens` na navegação principal.
- Telas e serviços afetados: `App.js`, novas entradas em `src/features/auth`, `src/features/home`, `src/features/modules`, `src/features/pdf`, `src/features/scanner`, `src/features/sql`, `src/features/conferencia`.
- Mudanças de comportamento:
  - `App.js` agora importa as telas exclusivamente por `src/features/*`;
  - foram criados entrypoints faltantes para auth, home, módulos, scanner, SQL, PDF viewer e scanner de conferência;
  - `src/screens` permanece como camada legada de compatibilidade, não mais como ponto de entrada canônico da navegação.
- Mudanças de contrato/schema:
  - nenhuma em dados;
  - o contrato arquitetural passou a ser: navegação principal consome apenas `features`, mesmo quando a implementação física ainda estiver em arquivo legado.
- Riscos pendentes:
  - a implementação real de várias telas ainda mora em `src/screens` e é reexportada por `features`;
  - remover `src/screens` de vez ainda exige migração física dos arquivos e revisão dos imports relativos internos.

### 2026-03-31 01:42:00 -0300
- Objetivo: destravar o build Android após remoção indevida de drawables ainda referenciados pelo tema e pelo manifest.
- Telas e serviços afetados: recursos Android em `android/app/src/main/res/drawable/*`, memória técnica.
- Mudanças de comportamento:
  - o app voltou a ter `rn_edit_text_material`, exigido por `AppTheme`;
  - o tema de splash voltou a apontar para um drawable válido com fundo branco e o logo central;
  - o manifest passou a ter um `notification_icon` resolvível novamente.
- Mudanças de contrato/schema:
  - nenhuma em dados;
  - a correção foi local aos recursos Android, sem mudança de navegação ou arquitetura.
- Riscos pendentes:
  - o `notification_icon` restaurado é funcional, mas pode ser refinado depois para um desenho mais adequado a notificações monocromáticas;
  - ainda há avisos de toolchain Android no ambiente local, mas eles não são a causa direta do erro de resource linking.

### 2026-03-31 01:29:00 -0300
- Objetivo: ajustar a escala dos ícones nativos para o logo ocupar mais área útil no launcher, aproximando o resultado do segundo mock mostrado pelo usuário.
- Telas e serviços afetados: assets nativos em `ios/gestao/Images.xcassets/AppIcon.appiconset`, `android/app/src/main/res/mipmap-*`, `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml`.
- Mudanças de comportamento:
  - os ícones de iOS e Android foram regenerados a partir de `assets/Image/LOGO.png` com ocupação maior do canvas;
  - o Android voltou a ter `ic_launcher_round.png` e `ic_launcher_round.xml`, compatíveis com o `roundIcon` do `AndroidManifest`;
  - os adaptive icons do Android foram normalizados com `background`, `foreground` e `monochrome`.
- Mudanças de contrato/schema:
  - nenhuma em dados;
  - não foi recriado script no repositório; o ajuste foi aplicado diretamente nos assets nativos.
- Riscos pendentes:
  - a validação final de percepção visual ainda depende de abrir o app no launcher do device/emulador;
  - se o logo base mudar novamente, os assets precisarão ser regenerados de novo.

### 2026-03-31 09:58:00 -0300
- Objetivo: substituir os ícones nativos recém-gerados pelo pacote manual fornecido em `AppIcons-2`.
- Telas e serviços afetados: assets nativos em `ios/gestao/Images.xcassets/AppIcon.appiconset`, `android/app/src/main/res/mipmap-*`, memória técnica.
- Mudanças de comportamento:
  - o iOS agora usa o catálogo de ícones vindo de `AppIcons-2/Assets.xcassets/AppIcon.appiconset`;
  - o Android usa os `ic_launcher` do pacote manual e os `ic_launcher_foreground` foram redimensionados corretamente a partir de `AppIcons-2/playstore.png`;
  - `ic_launcher_round` foi alinhado com o mesmo pack visual.
- Mudanças de contrato/schema:
  - nenhuma em dados;
  - a fonte ativa dos ícones aplicados no projeto passou a ser o pacote `AppIcons-2`, não o PNG bruto do logo.
- Riscos pendentes:
  - `ic_launcher_monochrome` ainda permanece como derivação anterior, porque o pacote manual não trouxe variante monocromática específica;
  - se o pacote `AppIcons-2` mudar, a substituição precisa ser reaplicada manualmente.

### 2026-03-31 09:46:00 -0300
- Objetivo: gerar os ícones nativos do app a partir de `assets/Image/LOGO.png` para Android e iOS.
- Telas e serviços afetados: assets nativos em `ios/gestao/Images.xcassets/AppIcon.appiconset`, `android/app/src/main/res/mipmap-*`, script `scripts/generate_app_icons.swift`.
- Mudanças de comportamento:
  - o app passa a usar ícones gerados a partir do logo oficial do projeto;
  - o iOS agora tem `AppIcon.appiconset` preenchido com arquivos reais e `Contents.json` apontando para eles;
  - o Android teve `ic_launcher`, `ic_launcher_round`, `ic_launcher_foreground` e `ic_launcher_monochrome` regenerados em todas as densidades.
- Mudanças de contrato/schema:
  - nenhuma em dados;
  - foi adicionado um script reexecutável para regenerar os ícones nativos a partir do PNG-fonte.
- Riscos pendentes:
  - se o logo base mudar, é preciso rodar novamente `swift scripts/generate_app_icons.swift assets/Image/LOGO.png`;
  - o catálogo atual do iOS segue apenas com os slots já existentes no projeto, sem adicionar variantes de iPad que não estavam declaradas.

### 2026-03-31 09:12:00 -0300
- Objetivo: convergir o app para o padrão de `recebimentoTratativas`, tirando persistência de telas críticas, criando entradas canônicas em `src/features/*` e atualizando a documentação de arquitetura/layout/sync.
- Telas e serviços afetados: `App.js`, serviços/storage de `validade`, `conferencia`, `avaria`, `notifications`, `profile`, `settings`, telas legadas desses domínios, `docs/*`, `.codex/skills/gestao-mobile-standards/*`.
- Mudanças de comportamento:
  - `ListScreen`, `DashboardScreen`, `AddProductScreen`, `TratarScreen`, `ExcelScreen`, `PdfScreen`, conferência, avaria, perfil, configurações e notificações deixaram de acessar `AsyncStorage` diretamente;
  - `NotificationScreen`, `ProfileScreen` e `SettingsScreen` passaram a usar o shell padrão com `ScreenLayout` ou storage/service dedicado;
  - as rotas principais agora apontam para entradas em `src/features/*`, mesmo quando ainda existe wrapper temporário para compatibilidade.
- Mudanças de contrato/schema:
  - criação de serviços/storage canônicos para validade, conferência, avaria, perfil, configurações e notificações;
  - atualização de `docs` e `.codex` para refletir `recebimento_treatment_cases` como feature avulsa de conferência e o padrão por domínio como regra oficial.
- Riscos pendentes:
  - ainda existem wrappers temporários em `src/features/*` apontando para implementações em `src/screens/*`;
  - telas muito grandes continuam precisando de quebra interna em componentes e hooks locais;
  - `coresAuth.js` ainda concentra tema demais para o padrão final desejado.

### 2026-03-31 00:54:00 -0300
- Objetivo: reestruturar o espelho de recebimento para o fluxo real de tratativa, com desfechos finais corretos, tipo de ocorrência separado, numeração por fornecedor, foto do produto, validade no padrão de `AddProduct` e lookup compartilhado de produto.
- Telas e serviços afetados: `EspelhoRecebimentoScreen`, `ConferenciaTratativasRecebimentoScreen`, `tratativaCaseMapper`, `tratativaCaseService`, `tratativaPdfService`, `schema_app_v1.sql`, `productLookupService`, `localImageService`, `AddProductScreen`.
- Mudanças de comportamento:
  - o espelho agora exige `Código do fornecedor` e gera `TR {supplier_code} - {NNNN}` no primeiro salvamento;
  - `Tipo de ocorrência` e `Desfecho` foram separados; falta no recebimento usa quantidades esperada/recebida/faltante dinâmicas;
  - `Formas de tratativa` saíram da UI e do PDF;
  - a tela passou a permitir foto via câmera/galeria, scanner de EAN e preenchimento automático por lookup local;
  - a validade deixou de ser texto livre e passou a usar `DateTimePicker` no padrão do cadastro de produto;
  - a listagem passou a resumir ocorrência, fornecedor e quantidade conforme o novo contrato.
- Mudanças de contrato/schema:
  - adição de `supplier_code`, `doc_sequence_number`, `occurrence_type`, `expected_quantity` e `received_quantity` em `recebimento_treatment_cases`;
  - `resolution_type` passou a refletir apenas `devolucao`, `troca`, `tratativa` e `descarte`;
  - `handling_methods` e `handling_method` seguem presentes no schema apenas por compatibilidade, mas foram removidos do fluxo funcional do app;
  - o lookup de produto e a persistência local de imagem foram extraídos para serviços compartilhados.
- Riscos pendentes:
  - é necessário aplicar o SQL novo no Supabase para sincronização remota completa do novo contrato;
  - a rota `BarcodeScannerScreen` precisa continuar registrada com esse nome, porque o espelho passou a usá-la com retorno para a própria tela;
  - ainda falta validar tudo em runtime no device depois de recarregar o bundle, principalmente câmera, scanner e PDF com imagem local/remota.

### 2026-03-30 23:40:14 -0300
- Objetivo: reduzir o nome longo das telas de tratativas de recebimento, substituir seleção por rolagem por multi-seleção com modal e iniciar uma memória técnica contínua no repositório.
- Telas e serviços afetados: `ConferenciaTratativasRecebimentoScreen`, `EspelhoRecebimentoScreen`, `tratativaCaseMapper`, `tratativaCaseStorage`, `tratativaPdfService`, `schema_app_v1.sql`.
- Mudanças de comportamento:
  - headers do recebimento passam a usar textos curtos;
  - busca da lista fica com placeholder menor;
  - `Motivos` e `Formas de tratativa` passam a aceitar múltiplas opções com resumo visual na tela;
  - seleção de `Outro` exige preenchimento de `Observação`.
- Mudanças de contrato/schema:
  - adição de `reasons text[]` e `handling_methods text[]` em `recebimento_treatment_cases`;
  - migração automática de casos antigos com `reason` e `handling_method` simples para arrays equivalentes;
  - cache local é regravado no formato novo após leitura normalizada.
- Riscos pendentes:
  - é necessário aplicar o SQL novo no Supabase para sincronização remota completa dos arrays;
  - a validação visual em device ainda depende de recarregar o app, porque este shell está sem `node` no `PATH`.
