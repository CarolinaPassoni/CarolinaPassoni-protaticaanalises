# ProTática — V6.9.1 — correção Gemini 3.8

## Causa do teste falso-negativo
O V6.9 usava `maxOutputTokens: 24`. No Gemini 3.8 Flash, esse limite inclui
também os tokens internos de raciocínio. O modelo respondia à API, mas podia
encerrar antes de produzir o texto esperado, gerando “teste de consistência falhou”.

## Correções
- Teste Gemini:
  - usa `ThinkingLevel.LOW`;
  - remove o teto de 24 tokens;
  - considera qualquer resposta textual não vazia como conexão válida;
  - registra apenas `finishReason`, modelo, latência e status — nunca a chave.
- Pesquisa Google da análise: `ThinkingLevel.LOW`.
- Análise tática principal:
  - `ThinkingLevel.MEDIUM`;
  - teto de saída elevado de 8192 para 32768;
  - remove `temperature: 0.1`.
- “Pergunte ao Jogo”:
  - `ThinkingLevel.LOW`;
  - teto 8192;
  - remove temperature baixa.
- Dossiê:
  - `ThinkingLevel.MEDIUM`;
  - teto 16384;
  - remove temperature baixa.

Nenhuma credencial é adicionada ao repositório.
