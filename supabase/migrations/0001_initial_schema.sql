create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  preferred_locale text not null default 'pt-BR',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null default 'voice',
  started_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.conversation_states (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  active_intent text,
  missing_slots jsonb not null default '[]'::jsonb,
  draft_payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  direction text not null check (direction in ('expense', 'income', 'transfer')),
  description text not null,
  amount numeric(12,2),
  currency text not null default 'BRL',
  category text,
  occurred_on date,
  source text not null default 'voice',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  amount numeric(12,2),
  recurrence_rule text,
  day_of_month int,
  starts_on date,
  ends_on date,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.commitment_occurrences (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid not null references public.commitments(id) on delete cascade,
  due_on date not null,
  status text not null default 'pending',
  transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  related_entity_type text,
  related_entity_id uuid,
  channel text not null default 'push',
  scheduled_for timestamptz not null,
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  bucket text not null,
  path text not null,
  mime_type text,
  kind text not null default 'receipt',
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_states enable row level security;
alter table public.transactions enable row level security;
alter table public.commitments enable row level security;
alter table public.commitment_occurrences enable row level security;
alter table public.reminders enable row level security;
alter table public.attachments enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = id);

create policy "conversations_select_own"
  on public.conversations
  for select
  using (auth.uid() = user_id);

create policy "transactions_select_own"
  on public.transactions
  for select
  using (auth.uid() = user_id);

create policy "commitments_select_own"
  on public.commitments
  for select
  using (auth.uid() = user_id);

create policy "reminders_select_own"
  on public.reminders
  for select
  using (auth.uid() = user_id);

create policy "attachments_select_own"
  on public.attachments
  for select
  using (auth.uid() = user_id);

-- Policies de insert/update/delete devem ser refinadas junto com o fluxo
-- definitivo de autenticacao e as responsabilidades do backend.

insert into storage.buckets (id, name, public)
values
  ('receipts', 'receipts', false),
  ('conversation-audio', 'conversation-audio', false)
on conflict (id) do nothing;

