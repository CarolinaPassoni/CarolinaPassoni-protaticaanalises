# Revisão do ProTática 6.10.15 — 23/09/2026

## Diagnóstico confirmado

O ZIP enviado corresponde aos 76 arquivos equivalentes da branch main clonada. O serviço Render estava executando um commit anterior ao topo dessa branch. A compilação original passava; isso não cobria os problemas funcionais encontrados.

Os logs de 22/09 registraram erros 429 por esgotamento de cota diária do Gemini, erros 503 por indisponibilidade do provedor e bloqueio de identidade com “ESTADUAL” interpretado como adversário de Prosperidade.

## Correções

1. Verificação de vídeo envia o token de autenticação.
2. Links YouTube são validados por domínio exato e convertidos para URL canônica, incluindo links curtos, mobile e IDs diretos.
3. Hífens e rótulos de competição não são tratados como confrontos no título.
4. Nomes identificados pela IA e sua ordem são preservados, evitando atribuir estatísticas ao adversário quando o confronto aparece invertido.
5. Métricas ausentes não descartam todo o relatório: são mantidas como indisponíveis e a análise é classificada como parcial. O portão de conflito entre equipes permanece ativo.
6. O complemento tático automático torna-se opcional; recálculo manual reutiliza o controle de cota e indisponibilidade dos modelos.
7. A renovação da cota diária usa meia-noite no fuso do Pacífico, conforme a documentação do Google, incluindo horário de verão. Modelos em espera não são chamados repetidamente.
8. Análises simultâneas da mesma conta são bloqueadas para evitar duplicação de consumo.
9. Intervalos inválidos, não numéricos, invertidos ou superiores a três horas são recusados.
10. Vídeos temporários são apagados também nas saídas antecipadas; PDFs são gerados em memória sem acumular arquivos no disco.
11. FFmpeg executa sem shell e de forma assíncrona, para não bloquear as demais requisições HTTP durante a extração.
12. Atualizações no banco preservam partidas de competições, campos de origem da API-Football, visibilidade e data de criação. Gravação de análise e seus detalhes é transacional.
13. Registros táticos e equipes não podem ser sobrescritos usando IDs de outro proprietário. Sessões de contas bloqueadas deixam de permitir acesso.
14. Partidas finalizadas aguardando vídeo permitem acionar a busca de fonte.
15. Webhook de checkout não libera assinatura somente pelo status “complete” se o pagamento ainda não estiver pago; inclui confirmação assíncrona e referência de assinatura no formato atual da fatura.
16. Erros de JSON/upload e rotas de API inexistentes retornam JSON e status adequado.
17. Inicialização carrega `.env`, identifica a versão no health check e deixa de executar o script de limpeza destrutiva de partidas a cada boot.
18. Testes usam banco temporário isolado; o build do Blueprint usa `npm ci`.
19. Catálogo demonstrativo de jogadores não é mais semeado em banco novo de produção como se tivesse verificação atual.

## Verificações

- TypeScript: `npm run lint`.
- Compilação de frontend e servidor: `npm run build`.
- Suíte automatizada com banco temporário: testes de senha, normalização, PDF, persistência, autorização, rollback, integridade de competições/partidas, links, título, intervalos, token do navegador e espera entre chamadas Gemini.
- Testes HTTP locais: saúde, login, histórico autenticado, administrador negado a usuário comum, tentativa de sobrescrita entre contas, URL inválida, JSON inválido e rota inexistente.
- Os dois testes originais que dependem da rede são separados em `test:integration`. O teste original com rede também passou no diagnóstico, mas a extração visual ficou indisponível neste ambiente; esse resultado não comprova obtenção de frames no Render.

## Limites

A revisão corrige falhas reproduzidas e identificadas no código, não certifica ausência de todos os defeitos. Não foram usados dados reais de clientes, cobrados pagamentos ou enviados e-mails/Telegram para validação. Não foi executada análise real de vídeo com a chave Gemini de produção. Disponibilidade, cotas, cobrança do Google e restrições do YouTube continuam externas ao aplicativo. O build ainda informa um aviso de tamanho do bundle do frontend, sem impedir a compilação.

Referência sobre cotas: https://ai.google.dev/gemini-api/docs/rate-limits

## Resultado da execução desta revisão

TypeScript e build aprovados. Suíte: 22 testes, 20 aprovados, 2 testes de rede separados por configuração, nenhuma falha.

Publicação pendente: o GitHub permitiu leitura, mas negou criação da árvore de arquivos com HTTP 403 (Resource not accessible by integration). Nenhuma atualização foi gravada no GitHub; o Render permanece com a implantação anterior. Para publicar, conceda escrita à conexão GitHub ou atualize os arquivos deste ZIP na branch main do repositório conectado. O serviço tem deploy automático habilitado.
