# Arquitetura

- `Next.js` como PWA principal, com foco mobile-first e instalacao na tela inicial.
- `Flutter` como trilha secundaria para futuras experiencias nativas.
- `NestJS` como camada de orquestracao, parsing, regras de negocio e integracoes.
- `Supabase` para Postgres, Auth, Storage e politicas RLS.
- `Next.js` tambem cobre dashboard administrativo e visualizacao.
- `packages/shared` para contratos de tipos e enums reutilizaveis.
- `Redis` preparado para futuros jobs com BullMQ.

O desenho prioriza baixo acoplamento entre clientes e backend, preservando uma evolucao segura do nucleo conversacional.
