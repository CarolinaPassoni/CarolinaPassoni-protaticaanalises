# ProTática — V6.10.7 — retry inteligente e preservação de cota

Diagnóstico real do V6.10.6.1:
- gemini-3.8-flash: cota gratuita atingida (20 requests no projeto/modelo);
- gemini-3.6-flash: 503 por alta demanda;
- gemini-3.7-flash: 503 por alta demanda;
- gemini-flash-latest: 429/503.

## O que muda

### Backend
- prioriza 3.6 e 3.7 antes do 3.8;
- remove `gemini-flash-latest` do plano para evitar chamadas redundantes;
- faz somente uma rodada de modelos por requisição;
- modelos que retornam 429/503 entram em cooldown;
- cota diária detectada coloca o modelo em espera até o próximo dia UTC;
- 503 recebe cooldown temporário;
- o endpoint retorna `retryAfterSeconds`.

### Frontend
- se a API responder 429/503 recuperável, o ProTática NÃO aborta imediatamente;
- mantém a mesma análise na tela;
- espera automaticamente;
- mostra contagem regressiva;
- repete até 4 ciclos com espera progressiva;
- usuário não precisa clicar novamente em “Analisar Partida”.

## Importante
Este patch reduz desperdício de cota e torna o fluxo resistente, mas não cria
capacidade no provedor. Se todos os modelos permanecerem indisponíveis durante
todas as janelas de espera, a análise ainda será encerrada com uma mensagem clara.
