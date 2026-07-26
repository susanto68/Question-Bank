-- Question refresh agent metadata.
-- Safe to run repeatedly.

alter table public.question_bank
add column if not exists source_url text,
add column if not exists source_title text,
add column if not exists source_years integer[],
add column if not exists source_kind text,
add column if not exists source_checked_at timestamptz,
add column if not exists agent_run_id text,
add column if not exists updated_at timestamptz not null default now();

create index if not exists qb_source_kind_idx
  on public.question_bank (source_kind);

create index if not exists qb_source_checked_at_idx
  on public.question_bank (source_checked_at desc);

create index if not exists qb_agent_run_id_idx
  on public.question_bank (agent_run_id);
