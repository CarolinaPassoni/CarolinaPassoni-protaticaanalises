# Implantação no Render — ProTática

Esta versão está preparada para Render com Node.js 22 e banco SQLite em disco persistente.

## Arquitetura de produção

- Web service: Render Node.js
- Build: `npm ci && npm run build`
- Start: `npm start`
- Health check: `/healthz`
- Banco: SQLite em `DATA_DIR=/var/data`
- Disco persistente: 1 GB montado em `/var/data`
- Região sugerida: Virginia

## Importante sobre o banco

O Render usa filesystem efêmero por padrão. O arquivo SQLite só é persistente quando o serviço possui um **Persistent Disk** montado em `/var/data`. O `render.yaml` deste projeto já declara esse disco. Persistent Disk exige compute pago no Render.

Sem o disco, o sistema inicia e funciona, mas os dados gravados podem desaparecer em reinícios/redeploys. Não use dessa forma para produção.

## Variáveis obrigatórias

- `ADMIN_INITIAL_PASSWORD`: senha forte, mínimo recomendado de 20 caracteres.
- `APP_PUBLIC_URL`: URL HTTPS pública final do serviço.
- `GEMINI_API_KEY`: necessária para as análises de IA.

Stripe, SMTP e Telegram são opcionais até os respectivos módulos serem ativados. Nunca coloque os segredos diretamente no repositório.

## Stripe

Depois que o serviço estiver no ar, configure o endpoint do webhook no Stripe como:

`https://SEU-DOMINIO/api/stripe/webhook`

Copie o signing secret gerado pelo Stripe para `STRIPE_WEBHOOK_SECRET`.

## Banco existente

Se você já possui `protatica.sqlite`, copie o arquivo para o diretório montado `/var/data` antes de liberar o sistema para uso. Não versione o arquivo de produção no GitHub.
