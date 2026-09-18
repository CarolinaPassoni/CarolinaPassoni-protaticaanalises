# ProTática — V6.10.5 — métricas calculadas a partir do vídeo

Este patch SUBSTITUI o V6.10.4.

## Objetivo
Não apenas esconder métricas ausentes. Fazer o ProTática produzir métricas úteis
a partir do vídeo analisado, de forma transparente.

## Análises novas
O prompt passa a solicitar métricas DO TRECHO:
- posse de bola estimada;
- finalizações observadas;
- finalizações no alvo;
- grandes chances;
- xG aproximado por IA;
- ocupação territorial nos três terços.

Essas métricas são marcadas como estimativas do trecho e não como estatísticas
oficiais da partida completa.

## Análises antigas
Novo botão:
`Recalcular métricas do vídeo`

Ele:
1. usa a mesma URL do YouTube;
2. lê o trecho salvo da análise;
3. envia somente esse trecho ao Gemini;
4. calcula as métricas;
5. atualiza o payload da análise no Turso;
6. mantém o mesmo ID, dono e data de criação;
7. atualiza a tela sem precisar refazer toda a análise.

## Regras das métricas
- posse soma 100%;
- finalizações no alvo <= finalizações;
- replays não devem ser contados duas vezes;
- heatmap por terços soma 100% para cada time;
- xG é identificado como `xG estimado (IA)`;
- xG não é apresentado como estatística oficial.

## Estabilidade
O recálculo:
- usa timeout de 10 minutos;
- usa Gemini 3.8 como principal;
- tenta o modelo de fallback se necessário;
- limita a etapa de métricas a no máximo 15 minutos de vídeo por chamada.

Nenhuma variável de ambiente nova é necessária.
