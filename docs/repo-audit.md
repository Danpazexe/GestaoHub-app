# Auditoria do Repositório

## Visão geral

`Gestao` é um app mobile React Native com núcleo de produto em `src`, camadas nativas em `android/` e `ios/`, persistência remota modelada em `supabase/` e documentação canônica em `docs/` e `.codex/`.

Estado atual observado:
- versão do app: `0.0.31`
- entrypoints principais: `App.js` e `index.js`
- stack base: React Native `0.74.5`, React Navigation, React Native Paper, Notifee, Supabase, Vision Camera, HTML/PDF, XLSX
- padrão arquitetural atual: `src/features/<dominio>` como origem canônica das telas

Esta auditoria cobre o código e os artefatos próprios do projeto. Ela exclui da análise detalhada:
- `node_modules/`
- `.git/`
- `ios/Pods/`
- `ios/build/`
- `android/.gradle/`

## Árvore resumida das pastas relevantes

```text
Gestao/
├── App.js
├── index.js
├── app.json
├── package.json
├── metro.config.js
├── jsconfig.json
├── react-native.config.js
├── Gemfile / Gemfile.lock
├── produtos_exemplo.xlsx
├── src/
│   ├── components/
│   ├── constants/
│   ├── features/
│   │   ├── auth/
│   │   ├── avaria/
│   │   ├── conferencia/
│   │   ├── home/
│   │   ├── modules/
│   │   ├── notifications/
│   │   ├── pdf/
│   │   ├── profile/
│   │   ├── recebimentoTratativas/
│   │   ├── scanner/
│   │   ├── settings/
│   │   ├── sql/
│   │   └── validade/
│   ├── services/
│   └── utils/
├── android/
│   ├── app/
│   │   ├── build.gradle
│   │   ├── debug.keystore
│   │   ├── google-services.json
│   │   ├── proguard-rules.pro
│   │   └── src/main/{AndroidManifest.xml,res,assets}
│   ├── build.gradle
│   ├── gradle.properties
│   ├── settings.gradle
│   └── gradlew / gradlew.bat
├── ios/
│   ├── Podfile / Podfile.lock
│   ├── gestao/
│   │   ├── AppDelegate.*
│   │   ├── Info.plist
│   │   ├── Images.xcassets/
│   │   ├── LaunchScreen.storyboard
│   │   └── PrivacyInfo.xcprivacy
│   ├── gestao.xcodeproj/
│   ├── gestao.xcworkspace/
│   └── gestaoTests/
├── assets/
│   ├── Image/
│   ├── Perfil/
│   ├── Sound/
│   └── data/
├── supabase/
│   └── schema_app_v1.sql
├── docs/
└── .codex/
```

## Mapa funcional do app

### Núcleo de navegação
- `App.js` registra a navegação stack, define tema visual das barras do sistema, integra notificações do app e conecta todas as telas públicas.
- A navegação hoje já consome apenas `src/features/*/screens`.

### Domínios funcionais
- `auth`: entrada, login e cadastro.
- `home`: tela inicial, menu de funções e tela diagnóstica interna.
- `validade`: cadastro, lista operacional, dashboard, histórico de tratativas e exportações.
- `conferencia`: conferência de recebimento, saída, divergências e apoio de escaneamento/manual.
- `recebimentoTratativas`: espelho manual de ocorrências de recebimento, com PDF, cache e sync remoto.
- `avaria`: lotes de avaria, resolução, dashboard e histórico.
- `notifications`: regras de alertas e agenda de notificações.
- `profile`: dados locais do usuário e avatar.
- `settings`: preferências operacionais e do app.
- `scanner`: scanner genérico de código de barras.
- `pdf`: visualizador de PDF.
- `sql`: utilitário técnico de base local/importação/exportação.
- `modules`: base genérica de módulos, hoje mais próxima de infraestrutura de navegação do que de produto final.

## Screens e fluxos

As 29 telas públicas abaixo são as que aparecem na navegação registrada em `App.js`.

### Auth

#### `EntryScreen`
- Serve como porta de entrada do app.
- Exibe uma tela de apresentação/entrada com branding e versão do app.
- Encaminha o usuário para `LoginScreen` ou `RegisterScreen`.
- Melhoria aparente: manter esta tela leve; ela já parece cumprir bem o papel de splash interativo.

#### `LoginScreen`
- Faz autenticação do usuário usando `authService`.
- Centraliza o fluxo de login e já usa tema visual próprio do domínio de autenticação.
- É uma tela operacional de sessão, não de negócio.
- Melhoria aparente: revisar se todo o tratamento de erro e fallback local continua coerente com o fluxo Supabase e usuário dev.

#### `RegisterScreen`
- Responsável pelo cadastro de conta.
- Também depende de `authService`, com UI própria para criação de usuário.
- É a continuidade natural de `EntryScreen` e `LoginScreen`.
- Melhoria aparente: revisar consistência de validação entre cadastro, login e perfil.

### Home e módulos

#### `HomeScreen`
- É o hub principal após a autenticação.
- Mostra os módulos expostos do app e usa serviços de sessão/storage para compor indicadores rápidos.
- É a tela que organiza a entrada para validade, conferência, avaria e áreas auxiliares.
- Melhoria aparente: consolidar ainda mais os cards e indicadores em componentes/hooks locais do domínio home.

#### `ModuleFunctionsScreen`
- Exibe as funções disponíveis dentro de um módulo escolhido.
- Atua como uma camada de menu secundário, orientando o usuário para as telas finais.
- Fica entre a home e alguns fluxos operacionais.
- Melhoria aparente: consolidar essa camada com um contrato mais claro para módulos e ações, evitando lógica espalhada.

#### `ModuleBaseScreen`
- É uma base genérica/placeholder de módulo.
- Serve mais como apoio de navegação e composição do que como tela final de produto.
- Hoje parece existir para reduzir atrito em rotas e prototipação de módulos.
- Melhoria aparente: decidir se ela permanece como infraestrutura ou se sai do fluxo visível ao usuário.

#### `EasterEggScreen`
- É uma tela de diagnóstico interno.
- Inspeciona permissões, estado de notificações, câmera, configuração Supabase, versão do app e até `AsyncStorage`.
- Serve como painel técnico de suporte/QA, não como funcionalidade de negócio.
- Melhoria aparente: deixar explícito no relatório do produto que ela é uma tela administrativa/técnica e limitar exposição em builds finais.

### Validade

#### `DashboardScreen`
- É a visão analítica do módulo de validade.
- Consolida dados em gráficos, indicadores e exportações como PDF/XLSX.
- É uma tela central de leitura gerencial do módulo.
- Melhoria aparente: é uma das maiores telas do projeto, o que sugere extração de blocos visuais e consolidadores para reduzir complexidade.

#### `ListScreen`
- É a lista operacional principal de produtos por validade.
- Faz busca, renderiza itens, abre ações por swipe e inicia a tratativa legada via `TreatmentModal`.
- É a principal tela de operação diária do módulo.
- Melhoria aparente: o tamanho da tela indica acúmulo de regras de UI, busca e ações que podem ser quebradas em hooks e componentes menores.

#### `AddProductScreen`
- Faz cadastro e edição de produtos de validade.
- É a tela mais rica em captura: código interno, EAN, data de validade, foto, câmera/galeria, lookup local e upload de imagem.
- Também integra scanner e sincronização com Supabase.
- Melhoria aparente: continua sendo uma tela muito grande e sensível; merece divisão mais forte entre formulário, mídia, lookup e persistência.

#### `TratarScreen`
- Mostra o histórico de itens tratados no módulo de validade.
- Permite revisão, ações em itens tratados e exportação/compartilhamento do histórico.
- É o desdobramento natural do fluxo iniciado em `ListScreen`.
- Melhoria aparente: alinhar a origem dos dados e reduzir a quantidade de responsabilidades de exportação dentro da própria tela.

#### `ExcelScreen`
- Cuida de importação e exportação em planilhas.
- Usa `DocumentPicker`, `XLSX`, compartilhamento e feedback visual.
- É uma tela de apoio operacional para carga e saída em lote.
- Melhoria aparente: separar com mais nitidez o fluxo de importação, validação e resultado, para não concentrar tudo em uma única tela.

#### `PdfScreen`
- Gera/exporta a lista de validade em PDF.
- Lê cache local e templates HTML para compor o documento.
- É uma tela de saída documental do módulo.
- Melhoria aparente: o fluxo de geração pode migrar ainda mais para serviços, deixando a tela mais próxima de “assistente de exportação”.

### Conferência

#### `ConferenciaRecebimentoScreen`
- Executa conferência cega de recebimento.
- Trabalha com listas esperadas, progresso, totais, bônus e finalização do registro.
- Usa hooks, mocks e serviços do domínio para estruturar o fluxo.
- Melhoria aparente: apesar de já estar mais alinhada ao padrão de feature, ainda é uma tela muito grande e merece quebrar listagem, resumo e fechamento.

#### `ConferenciaSaidaScreen`
- É o equivalente da conferência cega para saída.
- Trabalha com progresso, totais, itens esperados, finalização e rascunhos.
- É irmã direta da tela de recebimento e compartilha boa parte do padrão de UI.
- Melhoria aparente: consolidar componentes comuns entre recebimento e saída para evitar duplicação estrutural.

#### `ConferenciaDivergenciasScreen`
- Lista e organiza divergências oriundas das conferências.
- É uma tela de auditoria operacional do módulo.
- Depende do serviço de registros de conferência.
- Melhoria aparente: revisar se a hierarquia de filtros, estados vazios e severidade visual acompanha a criticidade operacional do fluxo.

#### `ConferenciaScanScreen`
- Dá suporte ao preenchimento/escaneamento em fluxos de conferência.
- Combina entrada manual, scanner e campos auxiliares como data.
- É mais uma tela de apoio ao processo do que um destino final de negócio.
- Melhoria aparente: separar claramente os modos de uso para reduzir complexidade visual e cognitiva.

### Tratativas de recebimento

#### `ConferenciaTratativasRecebimentoScreen`
- Lista ocorrências de tratativa de recebimento.
- Faz busca, filtros, resumo estatístico, compartilhamento em PDF, navegação para edição e ações de status.
- É a tela índice do domínio `recebimentoTratativas`.
- Melhoria aparente: a base visual já está mais madura, mas a tela segue extensa e pode ganhar mais extração de listagem, filtros e cards de resumo.

#### `EspelhoRecebimentoScreen`
- É a tela mais importante do fluxo de tratativa de recebimento.
- Cria e edita o espelho manual com NF de origem, possível NF de devolução, código do fornecedor, produto, ocorrência, desfecho, imagem, validade, timeline e exportação.
- Também integra câmera, galeria, scanner, lookup local de produto, numeração automática por fornecedor e PDF.
- Melhoria aparente: é hoje a maior tela funcional do app e já virou um mini-subdomínio; a próxima evolução natural é extraí-la em blocos e hooks próprios por seção.

### Avaria

#### `AvariaEntryScreen`
- Cria e edita lotes de avaria.
- Captura tipo de dano, tipo de bônus, observações, quantidade e itens do lote.
- É a principal tela de entrada do módulo.
- Melhoria aparente: é muito grande para um único componente e pode ser quebrada por etapas ou por seções funcionais.

#### `AvariaListScreen`
- Lista lotes abertos de avaria.
- Organiza a fila operacional do módulo e encaminha para edição/resolução.
- Usa serviço dedicado do domínio.
- Melhoria aparente: revisar consistência visual e de estados em relação ao padrão mais novo usado em recebimento tratativas.

#### `AvariaHistoryScreen`
- Mostra o histórico de lotes concluídos.
- É a visão de fechamento e rastreabilidade do módulo.
- Complementa `AvariaListScreen` e `AvariaResolutionScreen`.
- Melhoria aparente: consolidar ações de histórico, filtros e métricas para reduzir duplicação com a lista aberta.

#### `AvariaDashboardScreen`
- Exibe indicadores do módulo de avaria.
- Usa gráficos e consolida lotes para leitura gerencial.
- É a porta analítica do domínio.
- Melhoria aparente: aproximar mais do shell padrão e reduzir dependência de cores/estilos antigos espalhados.

#### `AvariaResolutionScreen`
- Trata a resolução de um item ou lote de avaria.
- Permite definir o desfecho do dano e registrar observações.
- É a tela que concretiza o fechamento do fluxo.
- Melhoria aparente: revisar a clareza das ações destrutivas e dos estados de confirmação.

### Notificações, perfil e ajustes

#### `NotificationScreen`
- Configura regras de alerta e notificações do app.
- Trabalha com switches, agenda e permissões usando a camada de serviço do domínio.
- É um módulo de suporte operacional do sistema.
- Melhoria aparente: ainda é uma tela extensa; vale separar preferências, permissões e ações de teste/agendamento.

#### `ProfileScreen`
- Edita dados locais do usuário e foto de perfil.
- Usa seleção de imagem e storage dedicado.
- É uma tela simples de dados do usuário, não de domínio operacional.
- Melhoria aparente: alinhar mais fortemente com o shell padrão e validar se o perfil continua apenas local ou se terá sync remoto completo.

#### `SettingsScreen`
- Centraliza preferências do app, biometria e ajustes gerais.
- É uma tela transversal de comportamento do aplicativo.
- Usa storage próprio e integra biometria.
- Melhoria aparente: separar ajustes críticos, experimentais e de conveniência para reduzir densidade da tela.

### Scanner, PDF e SQL

#### `BarcodeScannerScreen`
- É o scanner genérico de código de barras do app.
- Usa câmera, permissões, feedback sonoro e háptico, além de retorno por navegação.
- É reaproveitado por fluxos como cadastro e tratativas.
- Melhoria aparente: como é infraestrutura compartilhada, merece contrato estável de entrada/retorno documentado no próprio domínio.

#### `PdfViewerScreen`
- É o visualizador genérico de arquivos PDF.
- Também permite compartilhamento do documento já gerado.
- Serve como infraestrutura reutilizável para saídas documentais.
- Melhoria aparente: manter a tela genérica e concentrar a lógica de origem do PDF nos domínios chamadores.

#### `SqlScreen`
- É uma ferramenta técnica/administrativa dentro do app.
- Usa menus, FAB, importação de arquivo, compartilhamento, schemas e carga da base local.
- Seu papel parece ser inspeção, manutenção e apoio de dados, não fluxo de usuário final.
- Melhoria aparente: separar o que é utilitário interno do que é funcionalidade suportada oficialmente para operação.

## Camadas técnicas fora das telas

### `src/components`
- Guarda componentes compartilhados do app.
- `ScreenLayout` é o shell padrão mais importante.
- `HeaderMenu`, `toastConfig` e os componentes de validade servem como infraestrutura transversal ou reutilização legada.
- Ponto de atenção: `coresAuth.js` ainda centraliza muitas paletas de domínios diferentes, o que dificulta modularidade visual.

### `src/constants`
- Hoje concentra principalmente `storage.js`, com as chaves globais de persistência local.
- É uma camada pequena, mas sensível, porque define contratos de cache do app.

### `src/services`
- Reúne integrações compartilhadas:
  - autenticação
  - bridge de storage
  - lookup de produto
  - persistência local de imagem
  - Supabase client/config/storage
  - sync remoto de validade
- Essa pasta é o centro de serviços realmente globais do projeto.

### `src/utils`
- Hoje contém `systemBars.js`.
- É um utilitário transversal de UX visual, responsável pela coerência de barra de status e barra de navegação por rota.

### `supabase/schema_app_v1.sql`
- Define o modelo relacional remoto do app.
- Cobre perfis, configurações, validade, tratativas de recebimento, avaria, conferência, bucket de imagens e políticas RLS.
- É a referência do backend operacional do projeto.

### Templates HTML/PDF
- A fonte canônica agora fica em `src/assets/templates/*`.
- Isso reduz divergência entre feature, asset nativo e documento exportado.

### Assets
- `assets/Image/`: branding e variações do logo.
- `assets/Perfil/`: avatar padrão.
- `assets/Sound/`: áudio de scanner/notificação.
- `assets/data/`: arquivo JSON de exemplo para importação.
- Também existe `produtos_exemplo.xlsx` na raiz como artefato de apoio operacional.

## Android e iOS

### Android
- `android/app/build.gradle` define app id, versão, build types e assinatura.
- `android/app/debug.keystore` está presente no repositório e a configuração release observada atualmente usa assinatura debug.
- `android/app/src/main/AndroidManifest.xml` e `res/` sustentam permissões, launcher icon, splash, notification icon, styles e sons.
- `android/app/src/main/assets/` inclui fontes e um template HTML empacotado.
- Em termos de função, `android/` é a camada de build, empacotamento e recursos nativos do APK.

### iOS
- `ios/Podfile` e `Podfile.lock` sustentam dependências CocoaPods.
- `ios/gestao/` concentra `AppDelegate`, `Info.plist`, assets, launch screen e metadados de privacidade.
- `gestao.xcodeproj` e `gestao.xcworkspace` sustentam o projeto Xcode e a integração com Pods.
- Em termos de função, `ios/` é a camada de build, empacotamento e recursos nativos do app Apple.

## Documentação e governança

### `docs/`
- É a documentação canônica do app mobile.
- Hoje já existe documentação de arquitetura, design system, mapa de features, sync/export e backlog de migração.
- Este arquivo amplia essa camada com uma leitura global do repositório.

### `.codex/`
- Guarda a skill local de padrão arquitetural/visual e a memória técnica contínua.
- É a camada de governança operacional do agente sobre o projeto.
- Seu valor está em manter consistência de decisão entre sessões.

## Principais oportunidades de melhoria

### 1. Quebrar telas gigantes
- As maiores telas hoje são `SqlScreen` (~1777 linhas), `EspelhoRecebimentoScreen` (~1630), `DashboardScreen` (~1214), `AddProductScreen` (~1146), `ListScreen` (~1139) e `ConferenciaRecebimentoScreen` (~1001).
- Esse é o principal risco de manutenção do projeto.

### 2. Atualizar a documentação canônica que ainda fala em legado removido
- a arquitetura canônica já foi corrigida para `src/features/*` e `src/internal/*`.
- o próximo passo é manter o restante dos documentos sempre sincronizado quando a estrutura mudar.

### 3. Corrigir aliases e configs que ficaram para trás
- `jsconfig.json` já não expõe mais `@screens/*`.
- ainda vale revisar aliases periodicamente para evitar caminhos mortos após refactors grandes.

### 4. Modularizar tema e layout
- `coresAuth.js` ainda concentra muita responsabilidade visual para muitos domínios.
- O padrão novo sugere tema global + tokens por domínio, não um único arquivo gigante.

### 5. Reduzir uso direto de chaves globais na UI
- O fluxo público principal já foi empurrado para `services` e `storage` de domínio.
- O uso direto remanescente de storage bruto ficou restrito a telas internas/diagnósticas em `__DEV__`.

### 6. Consolidar infraestrutura documental
- a fonte canônica de templates foi movida para `src/assets/templates/*`.
- o cuidado daqui para frente é impedir o retorno de cópias paralelas em feature ou asset nativo.

### 7. Fortalecer a camada nativa de release
- o build `release` Android já exige credenciais reais de assinatura fora do repositório.
- o próximo passo é plugar essas credenciais em CI/CD e formalizar o fluxo de distribuição iOS.

### 8. Limpeza e governança do repositório
- Há `.DS_Store` versionados e artefatos de apoio misturados à raiz.
- Vale padronizar melhor o que é asset operacional, o que é arquivo de exemplo e o que é lixo de ambiente.

### 9. Formalizar a fronteira entre tela de produto e ferramenta interna
- `EasterEggScreen` e `SqlScreen` têm perfil técnico/administrativo.
- O projeto ganharia clareza se essas telas fossem explicitamente tratadas como ferramentas internas.

### 10. Refinar a fronteira entre camada compartilhada e camada por domínio
- O projeto já avançou bastante em `src/features`, mas ainda tem componentes e serviços globais com peso alto.
- O próximo passo natural é decidir o que permanece compartilhado por design e o que deve migrar para domínios.

## Conclusão

O repositório já tem uma base arquitetural melhor do que um app React Native legado típico: a navegação principal está concentrada em `src/features`, o backend já está modelado em `supabase/schema_app_v1.sql` e existe documentação de padrão. O que mais pede atenção agora não é “organizar pastas”, e sim reduzir o tamanho das telas principais, alinhar a documentação com o estado atual do código e consolidar fronteiras entre UI, serviço, storage, tema e saída documental.
