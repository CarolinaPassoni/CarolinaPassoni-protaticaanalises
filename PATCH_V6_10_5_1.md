# ProTática — V6.10.5.1 — correção do build

Este patch corrige exclusivamente o erro de build encontrado no V6.10.5:

`ReferenceError: useNativeYouTubeVideo is not defined`

## Causa
O patcher tentava avaliar `useNativeYouTubeVideo` durante o build.
Essa variável existe somente no `server.ts` em tempo de execução.

## Correção
- remove a avaliação indevida durante o build;
- mantém as regras de métricas visuais do trecho;
- mantém o botão `Recalcular métricas do vídeo`;
- mantém atualização da análise existente no Turso;
- mantém posse estimada, finalizações, no alvo, grandes chances,
  xG estimado por IA e distribuição por terços.

## Validação realizada
A cadeia completa de patchers até o V6.10.5 foi executada localmente.
O V6.10.5 corrigido aplicou:
- 1 ajuste em `src/db-sqlite.ts`;
- 5 ajustes em `server.ts`;
- 8 ajustes em `src/components/AnalysisDisplay.tsx`;
sem ReferenceError.

Este patch substitui o arquivo:
`scripts/apply-metrics-v6-10-5.cjs`
