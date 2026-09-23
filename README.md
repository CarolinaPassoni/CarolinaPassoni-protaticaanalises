# ProTática Intelligence — 6.10.15

## Executar e validar

- Node.js 22 ou superior.
- `npm ci`
- `npm run lint`
- `npm test` — testes isolados; não acessam o banco Turso nem enviam mensagens.
- `npm run test:integration` — inclui os testes de extração pela rede/YouTube.
- `npm run build`
- `npm start`

Para desenvolvimento: `npm run dev`. A configuração `.env` é carregada na inicialização.

## Render

Repositório: `CarolinaPassoni/CarolinaPassoni-protaticaanalises`, branch `main`.
Build recomendado: `npm ci && npm run build`. Start: `npm start`. Saúde: `/healthz`.
O endpoint de saúde informa a versão para confirmar qual código está publicado.

Produção exige `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` para persistência. Em um banco novo, configure `ADMIN_INITIAL_PASSWORD` com pelo menos 12 caracteres. Configure `APP_PUBLIC_URL` com a URL pública HTTPS.

`GEMINI_API_KEY` habilita análises. `GEMINI_MODEL` e `GEMINI_FALLBACK_MODEL` selecionam os modelos. `GEMINI_ENABLE_SECONDARY_SEARCH` e `GEMINI_ENABLE_TACTICAL_COMPLETION` são opcionais e ficam desativados por padrão para evitar chamadas adicionais. Métricas ausentes permanecem indisponíveis e o relatório é marcado como parcial.

`API_FOOTBALL_KEY` habilita sincronização das partidas. Uploads locais e extração de storyboards precisam de FFmpeg instalado e acessível; `FFMPEG_PATH` pode indicar o executável.

SMTP, Stripe e Telegram dependem de suas respectivas variáveis já documentadas em `render.yaml`. Nunca envie arquivos `.env`, banco local ou credenciais para o GitHub.

## Revisão

Veja `REVISAO_6.10.15.md` para correções, testes e limites da validação.
