-- ==========================================
-- EXAM RESEARCH & QUESTION BANK BUILDER PIPELINE
-- Tables for source-derived (non-AI) question research:
-- exam profiles -> source documents -> raw extracted questions
-- -> deduped into canonical question_bank, with source attribution
-- and per-run reporting.
-- Safe to run repeatedly.
-- ==========================================

create extension if not exists pgcrypto;
-- Enables vector similarity search for semantic dedup. If the `vector`
-- extension is not available on this Supabase project/tier, comment out
-- this line and the `semantic_embedding` columns below.
create extension if not exists vector;

-- 1. EXAM PROFILES
-- One row per exam/board segment (CBSE, ICSE, JEE Main, etc.)
create table if not exists public.exam_profiles (
  id uuid primary key default gen_random_uuid(),
  exam text not null,                      -- e.g. 'CBSE', 'JEE Main'
  conducting_body text,
  official_website text,
  classes_or_phases text[],                -- e.g. ARRAY['10','12'] or ARRAY['Prelims','Mains']
  subjects text[],
  syllabus_structure jsonb,
  paper_pattern jsonb,
  question_types text[],
  marks_distribution jsonb,
  difficulty_style text,
  latest_syllabus_year integer,
  source_urls text[],
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists exam_profiles_exam_idx on public.exam_profiles (exam);

alter table public.exam_profiles enable row level security;

drop policy if exists "Allow public read of exam profiles" on public.exam_profiles;
create policy "Allow public read of exam profiles"
  on public.exam_profiles for select to anon, authenticated using (true);

drop policy if exists "Allow service role to manage exam profiles" on public.exam_profiles;
create policy "Allow service role to manage exam profiles"
  on public.exam_profiles for all to service_role using (true) with check (true);


-- 2. SOURCE DOCUMENTS
-- Metadata for every discovered document (paper, syllabus, marking scheme, notice).
create table if not exists public.source_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  source_domain text,
  exam text not null,
  board text,
  class_or_phase text,
  subject text,
  chapter_or_topic text,
  year integer,
  paper_code text,
  language text,
  source_type text,              -- 'question_paper','sample_paper','model_paper','marking_scheme','syllabus','notice','answer_key'
  official_source boolean not null default true,
  downloaded_at timestamptz,
  checksum text,                 -- sha256 of the downloaded file/content
  extraction_status text not null default 'pending', -- 'pending','downloaded','extracted','failed','skipped'
  failure_reason text,
  agent_run_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists source_documents_exam_idx on public.source_documents (exam, board, class_or_phase, subject);
create index if not exists source_documents_status_idx on public.source_documents (extraction_status);
create index if not exists source_documents_checksum_idx on public.source_documents (checksum);
create index if not exists source_documents_run_idx on public.source_documents (agent_run_id);
create unique index if not exists source_documents_url_idx on public.source_documents (url);

alter table public.source_documents enable row level security;

drop policy if exists "Allow public read of source documents" on public.source_documents;
create policy "Allow public read of source documents"
  on public.source_documents for select to anon, authenticated using (true);

drop policy if exists "Allow service role to manage source documents" on public.source_documents;
create policy "Allow service role to manage source documents"
  on public.source_documents for all to service_role using (true) with check (true);


-- 3. RAW EXTRACTED QUESTIONS
-- Everything parsed straight out of a document, before dedup/review.
create table if not exists public.raw_extracted_questions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.source_documents(id) on delete cascade,
  board text,
  exam text not null,
  class_or_phase text,
  subject text,
  chapter text,
  topic text,
  type text,                     -- MCQ, Fill in the Blanks, Short Answer, etc.
  difficulty text,
  bloom_level text,
  question text not null,
  options jsonb,
  answer text,
  explanation text,
  marks integer,
  estimated_time integer,
  source_url text,
  source_title text,
  source_year integer,
  source_kind text,
  official_source boolean not null default true,
  normalized_question_text text not null,
  exact_hash text not null,
  source_document_hash text,
  semantic_embedding vector(1536),
  review_status text not null default 'pending', -- 'pending','duplicate_exact','duplicate_near','promoted','rejected','needs_review'
  promoted_question_id uuid references public.question_bank(id) on delete set null,
  agent_run_id text,
  created_at timestamptz not null default now()
);

create index if not exists req_exam_idx on public.raw_extracted_questions (exam, board, class_or_phase, subject);
create index if not exists req_exact_hash_idx on public.raw_extracted_questions (exact_hash);
create index if not exists req_review_status_idx on public.raw_extracted_questions (review_status);
create index if not exists req_document_idx on public.raw_extracted_questions (document_id);
create index if not exists req_run_idx on public.raw_extracted_questions (agent_run_id);
-- ivfflat index for embedding similarity search (requires ANALYZE after bulk loads)
create index if not exists req_embedding_idx on public.raw_extracted_questions
  using ivfflat (semantic_embedding vector_cosine_ops) with (lists = 100);

alter table public.raw_extracted_questions enable row level security;

drop policy if exists "Allow service role to manage raw extracted questions" on public.raw_extracted_questions;
create policy "Allow service role to manage raw extracted questions"
  on public.raw_extracted_questions for all to service_role using (true) with check (true);


-- 4. QUESTION SOURCES
-- Links a canonical question_bank row to every source it was seen in.
create table if not exists public.question_sources (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.question_bank(id) on delete cascade,
  document_id uuid references public.source_documents(id) on delete set null,
  raw_extracted_question_id uuid references public.raw_extracted_questions(id) on delete set null,
  source_url text not null,
  source_title text,
  source_domain text,
  source_kind text,
  source_year integer,
  official_source boolean not null default true,
  checksum text,
  created_at timestamptz not null default now()
);

create index if not exists question_sources_question_idx on public.question_sources (question_id);
create index if not exists question_sources_document_idx on public.question_sources (document_id);
create unique index if not exists question_sources_unique_idx
  on public.question_sources (question_id, source_url);

alter table public.question_sources enable row level security;

drop policy if exists "Allow public read of question sources" on public.question_sources;
create policy "Allow public read of question sources"
  on public.question_sources for select to anon, authenticated using (true);

drop policy if exists "Allow service role to manage question sources" on public.question_sources;
create policy "Allow service role to manage question sources"
  on public.question_sources for all to service_role using (true) with check (true);


-- 5. RESEARCH RUNS
-- One row per scheduled research run, for the run report.
create table if not exists public.research_runs (
  id uuid primary key default gen_random_uuid(),
  run_id text unique not null,
  exam text not null,
  board text,
  segment text,                  -- free-text description of what was researched this run
  status text not null default 'running', -- 'running','completed','failed'
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  sources_found integer default 0,
  documents_downloaded integer default 0,
  questions_extracted integer default 0,
  exact_duplicates integer default 0,
  near_duplicates integer default 0,
  unique_questions_added integer default 0,
  needing_review integer default 0,
  failed_urls jsonb,
  recommended_next_segment text,
  notes text
);

create index if not exists research_runs_exam_idx on public.research_runs (exam, board);
create index if not exists research_runs_started_idx on public.research_runs (started_at desc);

alter table public.research_runs enable row level security;

drop policy if exists "Allow public read of research runs" on public.research_runs;
create policy "Allow public read of research runs"
  on public.research_runs for select to anon, authenticated using (true);

drop policy if exists "Allow service role to manage research runs" on public.research_runs;
create policy "Allow service role to manage research runs"
  on public.research_runs for all to service_role using (true) with check (true);


-- 6. DEDUP SUPPORT ON THE CANONICAL question_bank TABLE
alter table public.question_bank
  add column if not exists exact_hash text,
  add column if not exists source_document_hash text,
  add column if not exists semantic_embedding vector(1536),
  add column if not exists official_source boolean not null default false,
  add column if not exists exam text; -- exam name for non-board exams (UPSC, JEE, NEET, CAT, etc.)

create index if not exists qb_exact_hash_idx on public.question_bank (exact_hash);
create index if not exists qb_exam_idx on public.question_bank (exam);
create index if not exists qb_embedding_idx on public.question_bank
  using ivfflat (semantic_embedding vector_cosine_ops) with (lists = 100);
