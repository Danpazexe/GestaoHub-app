# Segurança e Release

## Assinatura Android
- o build `release` não usa mais `debug.keystore`.
- a assinatura agora exige credenciais externas via propriedades Gradle ou variáveis de ambiente:
  - `GESTAOHUB_UPLOAD_STORE_FILE`
  - `GESTAOHUB_UPLOAD_STORE_PASSWORD`
  - `GESTAOHUB_UPLOAD_KEY_ALIAS`
  - `GESTAOHUB_UPLOAD_KEY_PASSWORD`
- essas credenciais não devem ser commitadas no repositório.
- em ambiente local, prefira `~/.gradle/gradle.properties` ou exportar as variáveis antes do build.

## Exemplo de configuração local
```properties
GESTAOHUB_UPLOAD_STORE_FILE=/Users/seu-usuario/.keys/gestaohub-upload.keystore
GESTAOHUB_UPLOAD_STORE_PASSWORD=senha-do-keystore
GESTAOHUB_UPLOAD_KEY_ALIAS=gestaohub
GESTAOHUB_UPLOAD_KEY_PASSWORD=senha-da-chave
```

## Comandos de build
- debug:
  - `yarn android`
  - `cd android && ./gradlew :app:assembleDebug`
- release:
  - `cd android && ./gradlew :app:assembleRelease`

Se as credenciais de release não estiverem presentes, `assembleRelease` falha de propósito.

## Supabase e RLS
- o schema canônico está em [schema_app_v1.sql](/Users/daniel/Documents/Gestao/supabase/schema_app_v1.sql).
- as tabelas de produto e operação têm RLS habilitado e políticas owner-based.
- revisão recomendada após toda mudança de schema:

```sql
select tablename
from pg_tables
where schemaname = 'public'
and not exists (
  select 1
  from pg_policies
  where pg_policies.tablename = pg_tables.tablename
);
```

## Checklist de auditoria RLS
- confirmar `enable row level security` em toda tabela de domínio.
- confirmar policy `using` e `with check` baseadas em `auth.uid()`.
- confirmar buckets e objetos com políticas equivalentes por pasta/usuário.
- testar `select`, `insert`, `update` e `delete` com usuário autenticado e não autenticado.

## Diagnóstico sensível
- telas de diagnóstico interno devem viver em `src/internal/*`.
- telas como `EasterEggScreen` não entram na navegação pública fora de `__DEV__`.
- leitura completa de storage local, tokens e permissões detalhadas deve ficar restrita a ambiente de desenvolvimento.

## Privacidade técnica já existente
- o cadastro já exige aceite de termo/política no fluxo de autenticação.
- o iOS já possui [PrivacyInfo.xcprivacy](/Users/daniel/Documents/Gestao/ios/gestao/PrivacyInfo.xcprivacy).
- LGPD completa, exclusão de conta e portabilidade continuam como trilha de fase seguinte.
