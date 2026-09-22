# ProTática — V6.10.10 — Análise automática

## Alterações

- Remove a necessidade de clicar em botão para completar a análise.
- Novas análises verificam e completam automaticamente:
  - posse de bola;
  - finalizações e finalizações no alvo;
  - xG e grandes chances;
  - mapa de calor;
  - fases ofensiva e defensiva.
- Análises antigas incompletas são complementadas automaticamente quando abertas.
- Cada análise antiga gera somente uma tentativa automática por abertura, evitando chamadas duplicadas.
- Corrige a validação que interpretava campo vazio como número zero.
- Mantém a resposta sincronizada com o payload relido do banco após o complemento.

Nenhuma nova variável de ambiente é necessária no Render.
