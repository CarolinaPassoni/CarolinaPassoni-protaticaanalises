# ProTática — Relatório de Validação da Versão Corrigida

## Testes executados

- **Migration em banco novo:** aprovada. As colunas multiusuário foram criadas e a tabela `teams` foi reconstruída sem `UNIQUE(name)` global.
- **Seed administrativo:** aprovado. Em produção, inicialização sem `ADMIN_INITIAL_PASSWORD` forte falha de forma intencional; com senha forte, inicializa normalmente.
- **Isolamento de análises:** aprovado. Conta A não lista, lê nem exclui análise da Conta B.
- **Sessões:** aprovado. O token bruto entregue ao cliente não é armazenado diretamente no SQLite; o banco guarda SHA-256.
- **Módulos táticos:** aprovado em teste de isolamento para planos de treino e evidências, incluindo bloqueio de exclusão cruzada. O mesmo padrão de filtro foi aplicado a pranchetas, metas, equipes e dossiês.
- **Validação sintática TypeScript:** não foram encontrados diagnósticos de sintaxe `TS1xxx` no código alterado.

## Limitação do ambiente de validação

O ZIP original não continha `node_modules`. A instalação completa das dependências não terminou dentro do limite do ambiente, portanto não foi possível executar o `vite build` e a suíte integral com todas as bibliotecas carregadas. O `tsc` global reporta erros esperados de módulos/tipos ausentes (React, Vite, Node typings etc.), que não representam por si só erro no código alterado.

Antes de publicar, execute no ambiente de desenvolvimento/CI:

```bash
npm ci
npm run lint
npm test
npm run build
```

Depois, teste Stripe em modo de teste com webhook assinado e uma conta de cada plano.


## Adaptação gratuita — Render + Turso

- `render.yaml` alterado para `plan: free`.
- Persistent Disk removido.
- Banco de produção alterado de arquivo local `node:sqlite` para Turso/libSQL remoto quando `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` estão configurados.
- Desenvolvimento local continua usando arquivo SQLite.
- Produção falha de forma explícita se as credenciais Turso não estiverem configuradas, evitando subir com banco efêmero por engano.
- Build configurado com `npm install && npm run build` porque a nova dependência `libsql` é instalada no deploy.

### Limitação da validação local
A instalação das dependências npm excedeu o tempo disponível neste ambiente, portanto a integração remota Turso deve ser confirmada no primeiro deploy. A API escolhida (`libsql`) é documentada como compatível com a API síncrona estilo better-sqlite3 e suporta conexão remota Turso.
