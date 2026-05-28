-- Enable UUID generation extension
create extension if not exists pgcrypto;

-- 1. STUDENTS TABLE
create table if not exists public.students (
  id text primary key, -- Stores Firebase UID
  email text unique not null,
  name text not null,
  phone text,
  board text,
  class_name text,
  subject text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for fast lookup by Firebase UID
create index if not exists students_id_idx on public.students (id);

-- Enable RLS for students
alter table public.students enable row level security;

create policy "Allow public read access for profiles"
  on public.students for select to anon, authenticated using (true);

create policy "Allow individuals to update their own profile"
  on public.students for update to authenticated
  using (auth.uid()::text = id)
  with check (auth.uid()::text = id);

create policy "Allow public insert during sign up"
  on public.students for insert to anon, authenticated
  with check (true);


-- 2. QUESTION BANK TABLE
create table if not exists public.question_bank (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null, -- Links to normalized generation parameters hash
  board text not null,
  class_name text not null,
  subject text not null,
  chapter text not null,
  type text not null, -- MCQ, Short Answer, Long Answer, True/False, Assertion Reason, Numerical
  difficulty text not null, -- Easy, Medium, Hard
  question text not null,
  options jsonb, -- ["A", "B", "C", "D"] or empty array
  answer text not null,
  explanation text,
  normalized_question text not null, -- Lowercase, punctuation stripped for caching
  created_at timestamptz not null default now()
);

-- Indexes for performance
create index if not exists qb_lookup_idx on public.question_bank (board, class_name, subject, chapter);
create index if not exists qb_cache_key_idx on public.question_bank (cache_key);
create index if not exists qb_normalized_question_idx on public.question_bank (normalized_question);

-- Enable RLS for question_bank
alter table public.question_bank enable row level security;

create policy "Allow public reads of question bank"
  on public.question_bank for select to anon, authenticated
  using (true);

create policy "Allow service role to manage question bank"
  on public.question_bank for all to service_role
  using (true)
  with check (true);


-- 3. MOCK TESTS TABLE
create table if not exists public.mock_tests (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  board text not null,
  class_name text not null,
  subject text not null,
  score int not null default 0,
  total_questions int not null default 10,
  duration_seconds int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists mock_tests_student_idx on public.mock_tests (student_id);

-- Enable RLS for mock_tests
alter table public.mock_tests enable row level security;

create policy "Allow students to read their own tests"
  on public.mock_tests for select to authenticated
  using (auth.uid()::text = student_id);

create policy "Allow students to insert their own tests"
  on public.mock_tests for insert to authenticated
  with check (auth.uid()::text = student_id);


-- 4. MOCK QUESTIONS TABLE (Tracks answers for each question in a test)
create table if not exists public.mock_questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.mock_tests(id) on delete cascade,
  question_id uuid not null references public.question_bank(id) on delete cascade,
  student_answer text,
  is_correct boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists mq_test_idx on public.mock_questions (test_id);

-- Enable RLS for mock_questions
alter table public.mock_questions enable row level security;

create policy "Allow students to read their own test details"
  on public.mock_questions for select to authenticated
  using (
    exists (
      select 1 from public.mock_tests t 
      where t.id = test_id and t.student_id = auth.uid()::text
    )
  );

create policy "Allow students to insert their own test details"
  on public.mock_questions for insert to authenticated
  with check (
    exists (
      select 1 from public.mock_tests t 
      where t.id = test_id and t.student_id = auth.uid()::text
    )
  );


-- 5. CERTIFICATES TABLE
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  student_id text not null references public.students(id) on delete cascade,
  test_id uuid not null references public.mock_tests(id) on delete cascade,
  board text not null,
  class_name text not null,
  subject text not null,
  score int not null,
  percentage numeric(5, 2) not null,
  certificate_id text unique not null, -- E.g. QB-2026-XXXX
  created_at timestamptz not null default now()
);

create index if not exists certificates_student_idx on public.certificates (student_id);

-- Enable RLS for certificates
alter table public.certificates enable row level security;

create policy "Allow students to read their own certificates"
  on public.certificates for select to anon, authenticated
  using (true); -- Publicly viewable by link for validation

create policy "Allow students to insert their own certificates"
  on public.certificates for insert to authenticated
  with check (auth.uid()::text = student_id);


-- 6. USER SESSIONS TABLE
create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id text references public.students(id) on delete cascade,
  ip_address text,
  user_agent text,
  login_at timestamptz not null default now(),
  logout_at timestamptz
);

-- Enable RLS for sessions
alter table public.user_sessions enable row level security;

create policy "Students can view their own sessions"
  on public.user_sessions for select to authenticated
  using (auth.uid()::text = student_id);

create policy "Students can record sessions"
  on public.user_sessions for insert to authenticated
  with check (auth.uid()::text = student_id);


-- 7. ANALYTICS EVENTS TABLE
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  student_id text references public.students(id) on delete set null,
  event_type text not null, -- E.g. 'page_view', 'test_attempt', 'question_generated'
  event_details jsonb, -- Arbitrary data
  created_at timestamptz not null default now()
);

-- Enable RLS for analytics
alter table public.analytics_events enable row level security;

create policy "Allow insert of analytics events"
  on public.analytics_events for insert to anon, authenticated
  with check (true);

create policy "Allow students to read their own analytics"
  on public.analytics_events for select to authenticated
  using (auth.uid()::text = student_id);
