# ProTática — V6.10.3 — Sanitização de métricas e mapa de calor

## Corrige os erros observados no relatório Prosperidade x Estadual

### Métricas
Textos como:
- Não disponível
- N/D
- Não identificado
- Sem dados

deixam de ser tratados como valores numéricos.

### Cards e tabelas
- posse de bola exibe um estado limpo de ausência de dado;
- finalizações, no alvo, xG e grandes chances não mostram mais
  `Não disponível - Não disponível`;
- tabelas escondem métricas totalmente ausentes;
- análises antigas também são higienizadas no momento da exibição.

### Mapa de calor
Os campos de terço aceitam apenas valores quantitativos entre 0 e 100.
Exemplos válidos:
- 25%
- 37.5%
- 40

Frases como:
`Baixo volume, jogo controlado predominantemente no campo adversário`
não são mais tratadas como percentual e não quebram o layout.

### PDF
- métricas ausentes deixam de ocupar linhas inúteis;
- frases qualitativas não entram mais nos campos de percentual do heatmap;
- relatórios antigos também são limpos durante a geração do PDF.

### Gemini
O prompt passa a exigir:
- omitir métricas sem evidência;
- nunca usar `Não disponível` como valor;
- heatmap somente com percentuais curtos;
- omitir mapa de calor quando não puder quantificar.

Nenhuma variável de ambiente precisa ser alterada.
