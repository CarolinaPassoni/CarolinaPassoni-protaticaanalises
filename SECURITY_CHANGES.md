# ProTática — Hardening de Produção

Esta versão contém uma revisão focada nos riscos encontrados na auditoria do código-fonte.

## Correções aplicadas

- Removida a credencial permanente `admin/admin123` e o fallback que reativava essa senha.
- Em produção, `ADMIN_INITIAL_PASSWORD` é obrigatório e deve ter pelo menos 12 caracteres.
- Tokens de sessão passam a ser armazenados como SHA-256 no SQLite; sessões legadas são migradas no primeiro uso.
- Login agora exige usuário/e-mail + senha e possui limitação de tentativas.
- Recuperação e confirmação de senha possuem rate limit e links usam `APP_PUBLIC_URL`, nunca o header `Origin` enviado pelo cliente.
- Análises agora recebem `user_id` no salvamento e consultas, exclusões, PDF, chat, dossiê e Telegram respeitam o proprietário.
- Análises legadas sem proprietário são atribuídas à conta administrativa durante a migração.
- A tabela `teams` recebe as colunas multiusuário faltantes e a restrição global `UNIQUE(name)` é removida.
- O salvamento de uma análise deixou de criar automaticamente registros globais na tabela `teams`.
- Checkout Stripe usa exclusivamente os preços de `OFFICIAL_PLANS`; valores enviados pelo navegador são ignorados.
- Checkout oficial usa `mode=subscription` e recorrência mensal/anual conforme o plano.
- Webhook Stripe valida `stripe-signature` com `STRIPE_WEBHOOK_SECRET` e tem idempotência para sessão/fatura.
- Renovação recorrente é tratada via `invoice.paid`; a fatura inicial é ignorada nesse fluxo para evitar ativação duplicada.
- Plano Scout aplica limite de 10 análises por mês no backend.
- Recursos Performance/Intelligence possuem bloqueio por plano no backend; trial e admin mantêm acesso de demonstração/gestão.
- Comandos privados do Telegram só atendem chats configurados e exigem `TELEGRAM_DATA_USER_ID` para definir qual conta pode ser consultada.
- Em produção, token do Telegram, Stripe secret e senha SMTP são lidos do ambiente/secret manager, não do SQLite.
- POST do cache de foto de jogador agora exige autenticação.
- Upload de vídeo foi reduzido de 2 GB para 750 MB.
- O servidor passa a respeitar `process.env.PORT`.
- Prompt da IA foi alterado para não fabricar posse, estatísticas, xG ou mapa de calor quando a evidência não existe.
- A interface deixou de exibir `50%` como valor padrão de posse quando não há dado.
- Endpoint público de partida só devolve análise vinculada quando ela estiver marcada como pública/featured.

## Variáveis obrigatórias/recomendadas para produção

```env
NODE_ENV=production
APP_PUBLIC_URL=https://seu-dominio
ADMIN_INITIAL_PASSWORD=uma-senha-forte-com-12-ou-mais-caracteres
GEMINI_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_PUBLISHABLE_KEY=...
STRIPE_WEBHOOK_SECRET=...
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM_EMAIL=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
TELEGRAM_CHANNEL_ID=...
TELEGRAM_VIP_GROUP_ID=...
TELEGRAM_DATA_USER_ID=<uuid-do-usuario-dono-dos-dados-do-bot>
```

## Observação sobre cobrança anual

O checkout seguro usa o preço anual oficial e recorrência anual. A alternativa visual antiga de “fidelidade anual cobrada mensalmente com valor promocional” foi bloqueada até existir um produto/preço específico no Stripe para essa regra comercial.

## Antes de publicar

Configure o webhook do Stripe apontando para `/api/stripe/webhook` e copie o signing secret para `STRIPE_WEBHOOK_SECRET`. Configure também o webhook do Telegram usando `TELEGRAM_WEBHOOK_SECRET`. Faça backup do arquivo `data/protatica.sqlite` antes da primeira inicialização desta versão, pois a migration da tabela `teams` reconstrói essa tabela quando detecta o schema legado.

## Endurecimento adicional da revisão final

- Registros táticos legados sem proprietário (planos, pranchetas, evidências, metas, equipes e dossiês) também são atribuídos ao administrador; contas comuns não recebem mais registros `user_id IS NULL`.
- Geração de senha provisória de checkout passou a usar `crypto.randomBytes`, e a busca de comprador pago prioriza o campo de e-mail real.
- `GEMINI_API_KEY` não é mais inferida incorretamente a partir de `GEMINI_MODEL`.
- `vite.config.ts` foi corrigido para resolver `__dirname` corretamente em projeto ESM.
- O privilégio administrativo agora depende de `role = admin`, e não de um nome de usuário reservado.
- Em produção, o painel não grava `STRIPE_SECRET_KEY`, senha SMTP, `TELEGRAM_BOT_TOKEN` ou `TELEGRAM_WEBHOOK_SECRET` no SQLite; esses segredos devem vir do ambiente/secret manager.
- O mapa de calor derivado apenas de storyboard/frames nunca recebe status `verified`; sem tracking adequado ele fica no máximo `partial`.
- O helper legado de envio de credenciais por SMTP também passou a respeitar a política de segredos somente por ambiente em produção.
