create extension if not exists pgcrypto;

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  board text not null,
  comment text not null,
  page_path text,
  created_at timestamptz not null default now()
);

create index if not exists comments_created_at_idx
  on public.comments (created_at desc);

alter table public.comments enable row level security;

drop policy if exists "No direct anonymous comment reads" on public.comments;
drop policy if exists "No direct anonymous comment writes" on public.comments;

create policy "No direct anonymous comment reads"
  on public.comments
  for select
  to anon
  using (false);

create policy "No direct anonymous comment writes"
  on public.comments
  for insert
  to anon
  with check (false);
