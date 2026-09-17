# ProTática — V6.9 — Gemini 3.8 Flash

- Suporte oficial a `gemini-3.8-flash`.
- `gemini-3.8-flash` passa a ser o fallback padrão do backend.
- Endpoint administrativo de status, sem expor a API key.
- Endpoint administrativo de teste real da Gemini, protegido por login de administrador e rate limit.
- Painel “Inteligência Artificial — Gemini” em Configurações:
  - chave configurada/não configurada;
  - modelo em uso;
  - botão Testar Gemini;
  - status conectado/falhou;
  - latência.
- O teste envia apenas um prompt mínimo de diagnóstico.
- Nenhuma chave é gravada em log, resposta ou frontend.

Após subir o patch, use no Render:
GEMINI_MODEL=gemini-3.8-flash
