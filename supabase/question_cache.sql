create extension if not exists pgcrypto;

create table if not exists public.question_cache (
  cache_key text primary key,
  board text not null,
  class_name text not null,
  subject text not null,
  chapter text not null,
  title text,
  questions jsonb not null,
  model text,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists question_cache_lookup_idx
  on public.question_cache (board, class_name, subject, chapter);

create index if not exists question_cache_updated_at_idx
  on public.question_cache (updated_at desc);

alter table public.question_cache enable row level security;

drop policy if exists "No direct anonymous question cache reads" on public.question_cache;
drop policy if exists "No direct anonymous question cache writes" on public.question_cache;

create policy "No direct anonymous question cache reads"
  on public.question_cache
  for select
  to anon
  using (false);

create policy "No direct anonymous question cache writes"
  on public.question_cache
  for insert
  to anon
  with check (false);
