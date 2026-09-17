# ProTática — Patch V6.6 — Estados corretos da partida

- Corrige `null` da API-Football que estava virando `0`, evitando `0 x 0` em jogos que ainda não começaram.
- Partida agendada passa a exibir `VS` e `PARTIDA AGENDADA`.
- Partida ao vivo exibe `PARTIDA EM ANDAMENTO`.
- Partida encerrada sem vídeo permanece como `AGUARDANDO VÍDEO DA PARTIDA`.
- No painel administrativo, a definição manual de vídeo fica desabilitada enquanto o jogo estiver agendado ou ao vivo.
- O texto da fonte passa a informar `Busca automática após o término` em jogos futuros.
- Aplica a mesma distinção de status na Home e na tela de Competição.
- A versão de sync sobe para 6.6 para regravar os placares nulos corretamente no Turso.
