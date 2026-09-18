# ProTática — V6.10 — Análise nativa de vídeo do YouTube

## Problema encontrado
Nos testes reais, o extrator de storyboard retornou:
`[STORYBOARD] Especificação de frames do vídeo não disponível`
e `extracted=0`.

Isso fazia o relatório depender de thumbnail/título e, quando a pesquisa
secundária estava sem quota, a análise ficava apenas parcial.

## Nova arquitetura
Para URLs públicas do YouTube, o ProTática passa a usar o suporte nativo
de vídeo da Gemini:
- `fileData.fileUri = URL do YouTube`;
- `videoMetadata.startOffset/endOffset` respeitam o trecho escolhido;
- amostragem de vídeo:
  - rápido/detalhado: 0,2 fps;
  - completo: 0,1 fps;
- o storyboard local fica apenas como fallback/complemento.

## Economia de quota
A pesquisa Google secundária da Gemini fica DESATIVADA por padrão.
Isso reduz uma chamada Gemini por análise e evita o 429 observado.
Ela pode ser reativada futuramente com:
`GEMINI_ENABLE_SECONDARY_SEARCH=true`

## Metadados sem pesquisa externa
O sistema usa o título da fonte como fallback para extrair:
- data;
- horário;
- temporada/ano;
- competição quando explicitamente presente.

## Relatório
- `createdAt` passa a ser exibido como “Análise gerada em”;
- “Data do Jogo” fica reservada ao campo real `contextoPartida.dataJogo`;
- fonte original do YouTube é sempre registrada na auditoria;
- validação visual passa a reconhecer o vídeo processado nativamente.

## Observação
O suporte a URL do YouTube é recurso oficial da Gemini em preview.
Na camada gratuita, o Google informa limite de até 8 horas de vídeo
do YouTube processado por dia.
