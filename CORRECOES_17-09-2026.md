# ProTática — Correções de interface e fluxo (17/09/2026)

## Corrigido

1. **Partida em destaque → Nova Análise**
   - Adicionado `videoUrl` ao tipo `Match`.
   - Adicionada coluna persistente `matches.video_url` com migração automática.
   - API de partidas agora lê e grava a URL do vídeo.
   - Cadastro administrativo de partida ganhou campo de URL do YouTube.
   - Em `Partidas`, administrador pode vincular ou editar a URL de uma partida já existente.
   - Se uma partida ainda não possuir vídeo, o sistema informa claramente isso em vez de abrir uma análise vazia.

2. **Planos**
   - Criada página `PlanosModule` dentro do sistema.
   - Exibe Scout, Performance e Intelligence nos ciclos mensal/anual.
   - Integra com `/api/subscription/checkout` quando Stripe estiver configurado.
   - Conta admin visualiza os planos sem iniciar cobrança.

3. **Relatórios**
   - O menu Relatórios não reutiliza mais o Home Dashboard.
   - Criada Central de Relatórios com histórico recente, acesso às análises, comparativo e nova análise.

4. **Configurações**
   - Criada página de Conta & Segurança.
   - Alteração de senha continua disponível pelo fluxo existente.
   - Admin pode abrir o painel administrativo a partir dessa página.

5. **Imagens**
   - Fotos de jogadores e thumbnail do vídeo usam `object-contain` para evitar cortes.
   - Logos dos times no Dashboard e em Partidas possuem fallback visual quando a URL externa falha.

6. **Autenticação administrativa**
   - Padronizado uso do token atual `protatica_auth` através de `getAuthHeaders()`.
   - Corrigidas ações de usuários administrativos, catálogo de jogadores, criação/edição de partidas, Stripe e teste SMTP que ainda procuravam a antiga chave `protatica_auth_token`.
   - `MySubscriptionModal` agora recebe o usuário atual e utiliza o token correto.

## Validação estática

O TypeScript global foi executado para procurar erros nos arquivos modificados. Os únicos erros gerais encontrados no ambiente foram de dependências npm ausentes no container de validação (`react`, `express`, `@types/node`, etc.). Não apareceram erros TypeScript adicionais específicos das alterações após filtrar os erros de módulos ausentes.

## Pós-deploy

Após substituir os arquivos no GitHub, o Render fará auto-deploy. A migration `matches.video_url` é idempotente e será aplicada ao banco Turso na inicialização.
