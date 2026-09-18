# ProTática — V6.10.6 — failover real entre modelos Gemini

## Problema observado
Os logs mostraram 503 em:
- gemini-3.8-flash
- gemini-3.7-flash

O sistema anterior repetia chamadas no mesmo modelo antes de trocar.

## Nova cadeia
Em 429, 503, timeout ou falha de rede:
1. gemini-3.8-flash
2. gemini-3.6-flash
3. gemini-2.5-flash
4. gemini-3.7-flash

A troca acontece imediatamente após cada falha transitória.

Se todos falharem, o sistema aguarda 5 segundos e executa uma segunda rodada.

## Compatibilidade 2.5
Gemini 2.5 não aceita `thinkingLevel`.
O ProTática converte automaticamente:
- MINIMAL -> thinkingBudget 512
- LOW -> 1024
- MEDIUM -> 4096
- HIGH -> 8192

## Aplicação
A cadeia vale para:
- análise principal;
- Pergunte ao Jogo;
- dossiê;
- recálculo de métricas do vídeo.

## Sem novas variáveis
Não é necessário alterar o Render.
`GEMINI_MODEL=gemini-3.8-flash` continua sendo o principal.
