# ProTática — V6.10.1 — boot assíncrono

Correção operacional do V6.10.

Problema identificado:
- `sync-api-football.cjs` rodava de forma bloqueante antes do servidor;
- a rotina de busca automática de vídeos podia demorar;
- o Render ficava sem porta HTTP aberta e mostrava `No open ports detected`.

Correção:
- a limpeza de integridade continua rápida no boot;
- o servidor HTTP passa a subir imediatamente;
- a sincronização API-Football/YouTube inicia 2 segundos depois, em background;
- sincronizações continuam a cada 30 minutos;
- se uma sincronização externa ficar travada por 5 minutos, ela é encerrada;
- um ciclo novo nunca inicia enquanto o anterior estiver rodando.

Nenhuma variável de ambiente precisa ser alterada.
