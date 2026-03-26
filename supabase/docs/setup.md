# Supabase Setup

## Objetivo

Usar o Supabase como camada principal de dados, autenticacao e storage, com o backend NestJS mantendo a orquestracao de regras e fluxos conversacionais.

## Passos

1. Criar um projeto no Supabase
2. Copiar as credenciais para `.env`
3. Aplicar `supabase/migrations/0001_initial_schema.sql`
4. Confirmar a criacao dos buckets `receipts` e `conversation-audio`
5. Revisar as politicas RLS e expandi-las antes da producao

## Observacoes

- O backend usa `SUPABASE_SERVICE_ROLE_KEY` para operacoes administrativas futuras.
- Web e mobile devem usar `anon key` com RLS.
- A modelagem inicial privilegia conversas por voz como nucleo do produto.

