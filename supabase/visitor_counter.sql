create extension if not exists pgcrypto;

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  student_id text,
  event_type text not null,
  event_details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_type_idx
  on public.analytics_events (event_type);

create index if not exists analytics_events_created_at_idx
  on public.analytics_events (created_at desc);

alter table public.analytics_events enable row level security;

drop policy if exists "Allow insert of analytics events" on public.analytics_events;

create policy "Allow insert of analytics events"
  on public.analytics_events
  for insert
  to anon, authenticated
  with check (true);
