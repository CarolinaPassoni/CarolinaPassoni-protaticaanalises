# ProTática — Patch V6.1

Correção do sincronizador da API-Football:

- substitui a consulta `from/to`, que exige filtros adicionais no plano/API, por consultas individuais usando `date`;
- faz 5 chamadas somente na primeira sincronização do dia (D-2 a D+2);
- nas atualizações horárias, usa apenas 1 chamada para o dia atual;
- mantém o consumo dentro do plano Free de 100 requisições/dia;
- preserva todas as regras rígidas de validação de partidas e vídeos do V6.
