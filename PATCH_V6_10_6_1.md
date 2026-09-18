# ProTática — V6.10.6.1 — correção do failover Gemini

Diagnóstico confirmado pelos logs de produção:
- `gemini-3.8-flash` retornou 503;
- o fallback chegou a `gemini-2.5-flash`;
- a API respondeu 404 informando que esse modelo não está mais disponível
  para novos usuários e recomendando `gemini-3.6-flash`.

Correções:
- remove `gemini-2.5-flash` e `gemini-2.5-flash-lite` da cadeia;
- cadeia passa a ser:
  `gemini-3.8-flash -> gemini-3.6-flash -> gemini-3.7-flash -> gemini-flash-latest`;
- 404 / `not available` passa a significar "pule este modelo e tente o próximo";
- a mesma regra vale para o recálculo de métricas do vídeo;
- adiciona log explícito da cadeia de failover no boot.

Nenhuma variável de ambiente precisa ser alterada.
