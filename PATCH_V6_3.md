# ProTática — Patch V6.3

Correções após a primeira sincronização real da API-Football.

- encerra explicitamente o processo de sincronização depois da gravação no Turso,
  permitindo que o servidor HTTP inicie imediatamente no Render;
- troca o filtro amplo de competições por correspondência exata;
- impede que AFC Champions League seja confundida com UEFA Champions League;
- reduz falsos positivos de torneios de base, femininos e competições com nomes parecidos;
- mantém a janela do plano Free: ontem, hoje e amanhã;
- preserva a validação rígida de vídeo por times e data oficial da partida.
