# ProTática — Patch V6.5

Fechamento da migração da API-Football no plano Free.

- quando a regra de sincronização muda, força a revalidação de ontem, hoje e amanhã;
- limpa e reinsere os registros da janela completa de 3 dias usando apenas as competições exatas;
- elimina falsos positivos herdados de versões anteriores também em ontem/amanhã;
- depois da migração, volta ao comportamento econômico: apenas hoje nas atualizações horárias;
- preserva análises já vinculadas e todas as validações de vídeo.
