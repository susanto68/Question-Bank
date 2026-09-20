-- Genuine previous-year question (PYQ) publication workflow.
-- Apply only after inspecting the live project and taking a backup. This file
-- intentionally creates no public write policy and no SECURITY DEFINER API.

create table if not exists public.syllabus_versions (
  id uuid primary key default gen_random_uuid(),
  board text not null,
  class_name text not null,
  subject text not null,
  academic_year text not null,
  source_url text not null,
  source_checksum text,
  official_source boolean not null default true,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (board, class_name, subject, academic_year, source_url)
);
alter table public.syllabus_versions enable row level security;
drop policy if exists "Published syllabus versions are readable" on public.syllabus_versions;
create policy "Published syllabus versions are readable"
  on public.syllabus_versions for select to anon, authenticated using (reviewed_at is not null);
drop policy if exists "Service role manages syllabus versions" on public.syllabus_versions;
create policy "Service role manages syllabus versions"
  on public.syllabus_versions for all to service_role using (true) with check (true);

create table if not exists public.syllabus_units (
  id uuid primary key default gen_random_uuid(),
  syllabus_version_id uuid not null references public.syllabus_versions(id) on delete cascade,
  unit_code text,
  unit_name text not null,
  parent_unit_name text,
  source_page integer,
  source_text text,
  created_at timestamptz not null default now(),
  unique (syllabus_version_id, unit_name)
);
alter table public.syllabus_units enable row level security;
drop policy if exists "Published syllabus units are readable" on public.syllabus_units;
create policy "Published syllabus units are readable"
  on public.syllabus_units for select to anon, authenticated
  using (exists (select 1 from public.syllabus_versions sv where sv.id = syllabus_version_id and sv.reviewed_at is not null));
drop policy if exists "Service role manages syllabus units" on public.syllabus_units;
create policy "Service role manages syllabus units"
  on public.syllabus_units for all to service_role using (true) with check (true);

-- A URL may be replaced by a board. Preserve each downloaded PDF revision.
create table if not exists public.source_document_revisions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.source_documents(id) on delete cascade,
  checksum text not null,
  storage_path text,
  final_url text not null,
  content_type text,
  byte_size bigint,
  downloaded_at timestamptz not null default now(),
  unique (document_id, checksum)
);
alter table public.source_document_revisions enable row level security;
drop policy if exists "Service role manages document revisions" on public.source_document_revisions;
create policy "Service role manages document revisions"
  on public.source_document_revisions for all to service_role using (true) with check (true);

alter table public.raw_extracted_questions
  add column if not exists question_number text,
  add column if not exists page_start integer,
  add column if not exists page_end integer,
  add column if not exists verbatim_question text,
  add column if not exists extraction_confidence numeric(4,3),
  add column if not exists extraction_engine text,
  add column if not exists extraction_model text,
  add column if not exists syllabus_unit_id uuid references public.syllabus_units(id) on delete set null,
  add column if not exists answer_evidence_status text not null default 'missing';

create table if not exists public.pyq_answer_evidence (
  id uuid primary key default gen_random_uuid(),
  raw_question_id uuid not null references public.raw_extracted_questions(id) on delete cascade,
  source_document_id uuid references public.source_documents(id) on delete set null,
  source_revision_id uuid references public.source_document_revisions(id) on delete set null,
  page_start integer,
  page_end integer,
  source_span text,
  answer_text text,
  evidence_kind text not null check (evidence_kind in ('marking_scheme', 'answer_key', 'manual_review')),
  created_at timestamptz not null default now()
);
alter table public.pyq_answer_evidence enable row level security;
drop policy if exists "Service role manages PYQ answer evidence" on public.pyq_answer_evidence;
create policy "Service role manages PYQ answer evidence"
  on public.pyq_answer_evidence for all to service_role using (true) with check (true);

create table if not exists public.pyq_review_decisions (
  id uuid primary key default gen_random_uuid(),
  raw_question_id uuid not null references public.raw_extracted_questions(id) on delete cascade,
  review_kind text not null check (review_kind in ('fidelity', 'answer')),
  decision text not null check (decision in ('approved', 'rejected', 'needs_revision')),
  reviewer_id text not null,
  rationale text,
  reviewed_at timestamptz not null default now(),
  unique (raw_question_id, review_kind, reviewer_id)
);
alter table public.pyq_review_decisions enable row level security;
drop policy if exists "Service role manages PYQ reviews" on public.pyq_review_decisions;
create policy "Service role manages PYQ reviews"
  on public.pyq_review_decisions for all to service_role using (true) with check (true);

create table if not exists public.pyq_coverage_targets (
  id uuid primary key default gen_random_uuid(),
  syllabus_unit_id uuid not null references public.syllabus_units(id) on delete cascade,
  required_questions integer not null check (required_questions > 0),
  required_years integer[] not null,
  active boolean not null default true,
  unique (syllabus_unit_id)
);
alter table public.pyq_coverage_targets enable row level security;
drop policy if exists "Published coverage targets are readable" on public.pyq_coverage_targets;
create policy "Published coverage targets are readable"
  on public.pyq_coverage_targets for select to anon, authenticated using (active);
drop policy if exists "Service role manages coverage targets" on public.pyq_coverage_targets;
create policy "Service role manages coverage targets"
  on public.pyq_coverage_targets for all to service_role using (true) with check (true);

-- No student-facing source can be marked published without both review kinds.
alter table public.question_bank
  add column if not exists pyq_published_at timestamptz,
  add column if not exists syllabus_unit_id uuid references public.syllabus_units(id) on delete set null;

create index if not exists raw_questions_syllabus_unit_idx on public.raw_extracted_questions (syllabus_unit_id);
create index if not exists pyq_reviews_raw_question_idx on public.pyq_review_decisions (raw_question_id, review_kind, decision);
create index if not exists question_bank_published_idx on public.question_bank (board, class_name, subject, chapter, pyq_published_at);
