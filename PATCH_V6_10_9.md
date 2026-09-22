# ProTática — V6.10.9 — Completar análise tática

## Problemas corrigidos
- Posse de bola permanecia como indisponível mesmo após análise/reprocessamento.
- Mapa de calor podia continuar vazio.
- Fase defensiva e fase ofensiva vinham com campos vazios ou placeholders.
- O recálculo antigo tratava apenas métricas e não completava ataque/defesa.
- A resposta do recálculo não era relida do Turso antes de voltar para a tela.

## Nova arquitetura
O passe focado de vídeo passa a gerar em conjunto:
- posse de bola estimada do trecho;
- finalizações/no alvo;
- grandes chances;
- xG estimado do trecho;
- distribuição territorial por terços;
- fase defensiva dos dois times:
  - posicionamento;
  - compactação/pressão;
  - transição defensiva;
- fase ofensiva dos dois times:
  - saída de bola;
  - criação/progressão;
  - finalização/movimentação.

## Análises novas
Se a análise principal vier sem qualquer um desses grupos, o backend executa
automaticamente um passe focado complementar no mesmo trecho do YouTube.

## Análises antigas
O botão passa a se chamar:
`Completar métricas e análise tática`

Ele atualiza a análise existente no Turso e depois RELÊ o payload salvo antes de
devolver para o frontend.

## Qualidade
- "Não disponível", "N/D", "evidência insuficiente" e equivalentes deixam de ser
  aceitos como análise ofensiva/defensiva.
- O passe focado exige descrições observacionais para os dois times.
- Posse/heatmap continuam identificados como estimativas visuais do trecho, não
  estatísticas oficiais da partida completa.

Nenhuma variável nova do Render é necessária.
