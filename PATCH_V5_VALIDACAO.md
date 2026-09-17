# ProTática — Patch V5: validação rígida de partidas

Este patch corrige o caso em que um fixture demonstrativo (ex.: Flamengo x Palmeiras)
continuava aparecendo como "hoje" porque tinha recebido uma URL antiga do YouTube.

## Regras aplicadas na inicialização do servidor
- Remove todos os fixtures demonstrativos originais sem análise vinculada, mesmo que tenham URL.
- Limpa URL de vídeo de partidas que ainda não estejam `finished`.
- Remove partidas agendadas/ao vivo sem fonte dos destaques.
- Registra as correções em `match_integrity_audit`.
- Se o Turso não estiver configurado em produção, a inicialização é bloqueada por segurança.

## Importante
O patch V5 evita dados falsos/antigos. Para preencher o calendário automaticamente com jogos reais,
o próximo passo é integrar um provedor oficial/confiável de fixtures e resultados.
