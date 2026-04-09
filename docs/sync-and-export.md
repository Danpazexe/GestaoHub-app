# Sincronização e Exportação

## Regra geral
- cache local primeiro.
- sincronização remota depois.
- resposta remota vazia é válida e deve sobrescrever cache antigo.
- falha remota não bloqueia operação local; o app continua com fallback.

## Configurações
- a configuração de localização logística usa cache local em `userSettings`.
- quando houver sessão remota disponível, o app sincroniza essa configuração em `user_settings.extra.logisticsLocationConfig`.
- leitura usa cache local primeiro e depois tenta atualizar pelo remoto.
- falha remota na configuração não impede o uso local.

## Validade
- `loadValidadeProducts` tenta Supabase primeiro e cai no cache local.
- `persistValidadeProducts` salva o cache e tenta sincronizar o conjunto no remoto.
- exclusão remota continua explícita quando o produto é removido da lista.
- produtos podem carregar `location` como objeto logístico persistido localmente e no remoto.

## Tratativas de recebimento
- o cache local é obrigatório.
- o app tenta `upsert` remoto para `recebimento_treatment_cases`.
- campos de compatibilidade podem continuar sendo gravados no remoto enquanto o contrato legado existir.

## Conferência
- histórico final e rascunhos usam storage encapsulado por domínio.
- divergências são derivadas no fechamento da conferência e persistidas como coleção própria.

## Avaria
- lotes usam storage encapsulado em `features/avaria/storage`.
- telas de avaria não devem manipular `AsyncStorage` diretamente.

## Exportação
- PDFs e planilhas devem consumir dados normalizados.
- exportação de validade e histórico não depende do estado atual de widgets temporários.
- documento de recebimento usa snapshot persistido.
- a fonte canônica de templates HTML/PDF fica em `src/assets/templates/*`.
- Android e iOS não devem manter cópias manuais divergentes de template.
