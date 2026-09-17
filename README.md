# ProTática — versão gratuita Render + Turso

Versão preparada para hospedar o backend/frontend no **Render Free** e manter os dados em um banco **Turso Cloud Free**, sem Persistent Disk pago.

## Deploy
Consulte `DEPLOY_GRATIS_RENDER_TURSO.md`.

## Banco
- Produção: Turso remoto por `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`.
- Desenvolvimento: SQLite local em `./data/protatica.sqlite`.

## Comandos
```bash
npm install
npm run build
npm start
```
