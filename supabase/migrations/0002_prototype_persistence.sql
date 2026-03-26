-- Ajuste transitório para fase de protótipo sem auth completa.
-- Permite persistir conversas e transações originadas pela PWA
-- antes de fechar o fluxo de usuário autenticado.

alter table public.conversations
  alter column user_id drop not null;

alter table public.transactions
  alter column user_id drop not null;

alter table public.commitments
  alter column user_id drop not null;

alter table public.reminders
  alter column user_id drop not null;

alter table public.attachments
  alter column user_id drop not null;

