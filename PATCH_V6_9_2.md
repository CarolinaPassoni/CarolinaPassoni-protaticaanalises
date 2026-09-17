# ProTática — V6.9.2 — Resiliência da Gemini

Problemas observados no teste real:
- 429 RESOURCE_EXHAUSTED na pesquisa secundária;
- 503 UNAVAILABLE / high demand na análise principal.

Correções:
- análise principal tenta novamente automaticamente em 5xx/503;
- em persistência da indisponibilidade, usa `gemini-3.7-flash` como fallback estável;
- em 429, evita insistir repetidamente no mesmo modelo e tenta o fallback;
- “Pergunte ao Jogo” e Dossiê também passam a usar retry/fallback;
- relatório de auditoria registra qual modelo realmente respondeu;
- erros brutos da API deixam de aparecer na interface;
- usuário recebe mensagem curta e apropriada para 429 ou indisponibilidade temporária;
- logs registram apenas código, modelo, tentativa e resultado, nunca a chave.

Variável opcional:
GEMINI_FALLBACK_MODEL=gemini-3.7-flash

Não é necessário configurar essa variável: o valor acima já é o padrão.
