# Gestão Hub Mobile

Esta pasta é a referência canônica do app mobile React Native deste repositório.

## Leituras principais
- `architecture.md`: arquitetura alvo, organização por domínio e responsabilidades.
- `repo-audit.md`: leitura global da pasta `Gestao`, incluindo estrutura, screens, camadas nativas e oportunidades de melhoria.
- `feature-map.md`: mapa funcional do app e da navegação principal.
- `data-model.md`: entidades locais e remotas, incluindo tratativas.
- `design-system.md`: padrões visuais e de interação.
- `sync-and-export.md`: regras de cache, sincronização e geração de documentos.
- `security-and-release.md`: assinatura release, revisão de RLS e endurecimento operacional.
- `migration-backlog.md`: débitos estruturais e trilha de convergência.

## Trilha do painel administrativo
- `admin-panel-blueprint.md`: leitura do estado real do mobile versus o que o painel admin precisa.
- `admin-web/README.md`: índice da documentação do painel web administrativo.
- `admin-web/product-overview.md`: visão de produto, personas, stack e escopo do painel.
- `admin-web/architecture.md`: arquitetura de pastas, módulos, layout e regras de implementação.
- `admin-web/design-system.md`: tokens visuais, componentes-base, responsividade e acessibilidade.
- `admin-web/feature-spec.md`: especificação funcional dos módulos existentes e dos novos módulos do painel.
- `admin-web/components-hooks-services.md`: componentes novos, hooks customizados, contratos de API e utilitários.
- `admin-web/delivery-checklist.md`: critérios de entrega, arquivos previstos, validação e comando de teste.

## Regra de governança
- novas features entram por domínio, não como telas gigantes com regra de negócio espalhada.
- telas novas ou migradas não persistem `AsyncStorage` diretamente quando já existir serviço dedicado.
- documentos HTML/PDF devem ser gerados a partir de dados normalizados e versionáveis.
- a fonte canônica de templates HTML/PDF fica em `src/assets/templates/*`.
- a camada remota é Supabase; o cache local é suporte operacional e fallback, não fonte eterna de verdade.
- wrappers temporários em `src/features/*` são aceitáveis para preservar nomes de rota, mas a lógica nova deve entrar no domínio.
