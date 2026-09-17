# ProTática — Patch V6: API-Football real + validação de vídeo

## O que muda
- Usa `API_FOOTBALL_KEY` e `API_FOOTBALL_BASE_URL` já configuradas no Render.
- Sincroniza fixtures oficiais para o Turso com ID oficial da partida.
- Atualiza data/hora em `America/Sao_Paulo`, competição, equipes, logos, estádio, status e placar.
- Monitora as principais competições já existentes no ProTática.
- Faz uma janela completa de 5 dias uma vez por dia e, depois, atualiza o dia atual no máximo 1 vez por hora.
- Mantém consumo muito abaixo do limite Free de 100 requisições/dia em uso normal.
- Partida finalizada sem vídeo validado recebe `finished_waiting_video` e NÃO libera análise automática.
- Vídeo só é aprovado se contiver os dois times e tiver data de publicação entre o dia oficial do jogo e até 3 dias depois.
- Vídeo antigo do mesmo confronto é rejeitado.
- Logos de clubes e competições passam a ser atualizados pela API-Football.

## Arquivos
- `package.json` — passa a iniciar pelo supervisor V6.
- `scripts/start-protatica.cjs` — executa integridade, sincronização e servidor; atualiza a cada hora.
- `scripts/sync-api-football.cjs` — integração oficial + validação rígida de vídeo.

## Segurança
A API key nunca é colocada no código. Ela continua somente no Environment do Render.
