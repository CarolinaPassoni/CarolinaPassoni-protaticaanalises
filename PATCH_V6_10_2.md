# ProTática — V6.10.2 — timeout e interface de análise de vídeo

Diagnóstico dos logs:
- o vídeo foi enviado corretamente à Gemini: `nativeYouTube=true`;
- a chamada anterior de 15 minutos caiu após aproximadamente 5 minutos;
- o SDK estava usando o timeout padrão;
- o frontend mostrava 95% por cronômetro, sem progresso real.

Correções:
- aumenta o timeout do cliente Gemini para 600.000 ms (10 minutos);
- trata `fetch failed`, timeout e reset de conexão como erros transitórios;
- reduz o número de tentativas longas da análise de vídeo;
- remove o percentual artificial de 95%;
- mostra mensagens de estado sem inventar progresso;
- atualiza o texto de Gemini 3.5 para Gemini 3.8;
- remove a informação falsa de Google Search em execução;
- adiciona `Teste rápido: primeiros 5 minutos`;
- esse novo trecho de 5 minutos passa a ser o padrão para testes;
- mantém 15/30/45 minutos e partida completa disponíveis.

Nenhuma variável do Render precisa ser alterada.
