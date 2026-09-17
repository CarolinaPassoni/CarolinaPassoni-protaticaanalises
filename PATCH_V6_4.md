# ProTática — Patch V6.4

Correções de consistência após a integração real com API-Football:

- partidas oficiais agendadas não são mais removidas dos destaques pela rotina de integridade;
- fixtures manuais/demonstrativos continuam protegidos e sem destaque indevido;
- força uma sincronização única quando a versão da regra muda, mesmo com cache recente;
- limpa da janela atual registros API antigos sem análise antes de importar novamente;
- remove, assim, falsos positivos herdados do filtro antigo (ex.: AFC Champions League);
- preserva qualquer partida que já tenha análise vinculada;
- mantém a janela Free de ontem/hoje/amanhã e a validação rígida de vídeos.
