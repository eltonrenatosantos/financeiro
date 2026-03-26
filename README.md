# Financeiro Voice

Base tecnica inicial de um gestor financeiro orientado por voz. Nesta fase, a entrada principal do produto passa a ser uma PWA em Next.js para facilitar testes no iPhone e Android sem depender das lojas.

## Visao Geral

- `apps/mobile`: trilha secundaria em Flutter, mantida para experimentacao nativa futura.
- `apps/api`: backend em NestJS, responsavel pela orquestracao da logica.
- `apps/web`: PWA principal em Next.js, com dashboard e base mobile-first.
- `packages/shared`: tipos, enums, constantes e schemas compartilhados.
- `supabase`: migrations, seed e documentacao de integracao.
- `docs`: contexto, arquitetura e roadmap.

## Estrutura

```text
/
  apps/
    api/
    mobile/
    web/
  packages/
    shared/
  supabase/
    migrations/
    seed/
    docs/
  docs/
  docker-compose.yml
  .env.example
  README.md
```

## Como Rodar

### Backend

1. Entre em `apps/api`
2. Instale dependencias com `pnpm install`
3. Rode `pnpm start:dev`

### Web

1. Entre em `apps/web`
2. Instale dependencias com `pnpm install`
3. Rode `pnpm dev`

### PWA Web

1. Entre em `apps/web`
2. Instale dependencias com `pnpm install`
3. Rode `pnpm dev`
4. Abra no celular ou navegador em `http://localhost:3000`

### Mobile Flutter

1. Entre em `apps/mobile`
2. Rode `flutter pub get`
3. Rode `flutter run`

O app Flutter continua no repositorio, mas nao e mais a prioridade de distribuicao nesta etapa.

## Configuracao do Supabase

1. Copie `.env.example` para `.env`
2. Preencha `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`
3. Aplique as migrations em `supabase/migrations`
4. Revise as politicas RLS iniciais antes de usar em producao

Mais detalhes em `supabase/docs/setup.md`.

## Variaveis de Ambiente

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET_RECEIPTS`
- `SUPABASE_STORAGE_BUCKET_AUDIO`
- `API_PORT`
- `API_CORS_ORIGIN`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `REDIS_URL`

## Redis Local

Suba o Redis com:

```bash
docker compose up -d redis
```

## Proximos Passos

1. Conectar apps ao mesmo contrato de tipos em `packages/shared`
2. Evoluir parser conversacional e pipeline de intents no backend
3. Adicionar captura de voz e instalacao PWA mais robusta no web mobile
