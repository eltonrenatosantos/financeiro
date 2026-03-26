alter table public.commitments
add column if not exists direction text not null default 'expense';

alter table public.commitments
drop constraint if exists commitments_direction_check;

alter table public.commitments
add constraint commitments_direction_check
check (direction in ('expense', 'income'));
