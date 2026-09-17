# ProTática — V6.8 — Ciclo automático pós-jogo

## Fluxo
Agendada → Em andamento → Encerrada → Busca de vídeo → Vídeo validado → Análise liberada

## Alterações
- API-Football atualizada a cada 30 minutos, com cooldown de 25 minutos.
- Primeira carga diária continua consultando ontem/hoje/amanhã; depois usa apenas hoje.
- Proteção de quota: interrompe novas consultas se restarem 8 ou menos chamadas registradas no dia.
- Consumo teórico normal: aproximadamente 50 chamadas/dia, abaixo das 100 do plano Free.
- Corrige a limpeza destrutiva: partidas existentes não são mais apagadas a cada sync.
- Preserva `video_verified_at`, URL validada e histórico de tentativas.
- Após FT/AET/PEN sem vídeo, tenta novamente:
  - até 6h do kickoff: a cada 30 min;
  - até 24h: a cada 90 min;
  - depois: a cada 6h, por até 3 dias.
- Máximo de 8 buscas de vídeo por ciclo.
- A busca de vídeo continua exigindo os dois clubes + conteúdo de highlights/jogo completo + data de publicação compatível.
- Tela Partidas atualiza silenciosamente a cada 60 segundos.
- Home atualiza silenciosamente a cada 90 segundos.
- Quando um vídeo for validado no backend, o botão de análise aparece sem Ctrl+F5.
