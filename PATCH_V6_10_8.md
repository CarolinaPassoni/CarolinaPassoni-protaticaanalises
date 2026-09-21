# ProTática — V6.10.8 — Trava de Identidade da Partida

## Problema real identificado
Nos logs de 21/09/2026, a análise salva usou:
- vídeo: `DtgHpaNVfc4`
- título: `ATLÉTICO CAPIXABA X PROSPERIDADE - 20/09 - 15H - CAPIXABÃO FEMININO 2026`
- trecho: 0–300s

Mesmo assim o sistema podia salvar conteúdo de outro jogo porque:
1. o status podia virar `verified` antes da resposta da IA;
2. após a IA responder, `parsed.timeA` e `parsed.timeB` eram sobrescritos
   pelos nomes esperados;
3. portanto uma divergência de identidade era apagada antes da auditoria.

## Correções
- adiciona `identidadeVideo` ao schema da resposta;
- obriga a IA a informar os times que realmente reconheceu visualmente;
- proíbe copiar automaticamente os nomes do título;
- o título passa a ser "identidade esperada", não prova;
- compara a dupla esperada com a dupla observada, aceitando ordem invertida;
- nomes são comparados com normalização e tolerância a sufixos como FC/EC;
- se a identidade visual não for confirmada ou divergir:
  - resposta HTTP 409;
  - relatório NÃO é salvo;
  - nenhuma tentativa automática de fallback é feita para esse erro;
- só depois da aprovação do portão os nomes canônicos são aplicados;
- grava `identityAudit` no relatório;
- uma URL de YouTube sem frames/transcrição local não recebe `verified`
  antes da confirmação visual da IA.

## Importante
A análise já salva com ID:
`870685c9-de76-4d90-a6fa-cb885a5b4dd7`
foi criada antes desta trava e deve ser tratada como não confiável até ser
reanalisada.

A fila automática para indisponibilidade 429/503 deve ser tratada depois desta
correção de identidade, pois não faz sentido automatizar novas tentativas antes
de garantir que o jogo correto será analisado.
