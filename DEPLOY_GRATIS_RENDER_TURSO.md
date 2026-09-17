# ProTática — Deploy gratuito com Render + Turso

Esta versão foi adaptada para operar sem Persistent Disk pago.

## Arquitetura
- **Aplicação:** Render Web Service no plano Free.
- **Banco:** Turso Cloud Free, compatível com SQLite/libSQL.
- **Persistência:** o banco fica no Turso e não depende do sistema de arquivos efêmero do Render.

## 1. Criar o banco Turso
1. Crie uma conta gratuita em https://turso.tech/.
2. Crie um banco, por exemplo `protatica`.
3. Obtenha a URL do banco (`libsql://...`) e um token de acesso.
4. Guarde os dois valores; não os publique no GitHub.

Pela CLI do Turso, os comandos equivalentes são:
```bash
turso db create protatica
turso db show protatica --url
turso db tokens create protatica
```

## 2. Criar o Blueprint no Render
Use o `render.yaml` desta versão. Ele está definido com `plan: free` e **não possui disk**.

No Blueprint, preencha obrigatoriamente:
- `ADMIN_INITIAL_PASSWORD` — senha forte do administrador.
- `TURSO_DATABASE_URL` — URL `libsql://...` do Turso.
- `TURSO_AUTH_TOKEN` — token do banco.

Depois do primeiro deploy, defina:
- `APP_PUBLIC_URL=https://SEU-SERVICO.onrender.com`

As integrações Gemini, Stripe, SMTP e Telegram podem ser configuradas depois.

## 3. Desenvolvimento local
Sem as variáveis Turso e fora de `NODE_ENV=production`, o sistema usa SQLite local em `./data/protatica.sqlite`.

## Observação
O Render Free pode suspender a aplicação quando fica inativa, mas os dados permanecem no Turso. O primeiro acesso após suspensão pode demorar mais.
