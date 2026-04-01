# Backlog de Migração

## Prioridade alta
- quebrar telas ainda muito grandes de `validade`, `conferencia` e `avaria` em subcomponentes e hooks locais por domínio.
- reduzir dependência do arquivo central `src/components/coresAuth.js` com tokens globais + tema local por feature.
- remover usos diretos de `STORAGE_KEYS` em screens e empurrar leitura/escrita para `services` e `storage` de domínio.
- consolidar telas internas e diagnósticas em `src/internal/*`, fora do fluxo público em produção.

## Prioridade média
- consolidar componentes transversais de seção, resumo, filtros e estados vazios.
- revisar `authService` e sessão para o mesmo padrão de storage/service usado em perfil e configurações.
- unificar templates HTML/PDF em uma origem canônica versionável dentro de `src/assets/templates`.

## Prioridade baixa
- automatizar smoke de bundle no pipeline.
- adicionar testes de fluxo para conferência, tratativas de recebimento e dashboard de validade.
