# ProTática — Patch V6.7 — Ordenação inteligente das partidas

- deixa de ordenar jogos pela data de criação no banco;
- usa o horário oficial `kickoff_at` da API-Football;
- prioriza partidas de hoje em destaque;
- dentro delas, ordena: ao vivo → agendadas → encerradas aguardando vídeo → encerradas com vídeo;
- jogos agendados são ordenados pelo horário de início;
- jogos encerrados aparecem do mais recente para o mais antigo;
- incorpora ao schema principal as colunas oficiais da integração, evitando dependência exclusiva do script de sync;
- na área administrativa, jogo encerrado sem vídeo passa a informar `Buscando vídeo validado`.
