-- ==========================================
-- AI QUESTION BANK & MOCK TEST SCHEMA UPGRADE
-- ==========================================

-- 1. Extend the question_bank table with rich metadata columns
ALTER TABLE public.question_bank 
ADD COLUMN IF NOT EXISTS bloom_level text,
ADD COLUMN IF NOT EXISTS concept_tag text,
ADD COLUMN IF NOT EXISTS learning_outcome text,
ADD COLUMN IF NOT EXISTS estimated_time integer, -- in seconds
ADD COLUMN IF NOT EXISTS marks integer,
ADD COLUMN IF NOT EXISTS source text DEFAULT 'ai',
ADD COLUMN IF NOT EXISTS topic_subtopic text,
ADD COLUMN IF NOT EXISTS source_url text,
ADD COLUMN IF NOT EXISTS source_title text,
ADD COLUMN IF NOT EXISTS source_years integer[],
ADD COLUMN IF NOT EXISTS source_kind text,
ADD COLUMN IF NOT EXISTS source_checked_at timestamptz,
ADD COLUMN IF NOT EXISTS agent_run_id text,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Extend the mock_tests table with student performance tracking metrics
ALTER TABLE public.mock_tests
ADD COLUMN IF NOT EXISTS percentage numeric(5, 2),
ADD COLUMN IF NOT EXISTS questions_attempted integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS correct_answers integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS wrong_answers integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS weak_topics jsonb,
ADD COLUMN IF NOT EXISTS strong_topics jsonb;

-- 3. Create high-performance indexes for board, class, subject, chapter, difficulty, type, and bloom level
CREATE INDEX IF NOT EXISTS qb_board_idx ON public.question_bank (board);
CREATE INDEX IF NOT EXISTS qb_class_name_idx ON public.question_bank (class_name);
CREATE INDEX IF NOT EXISTS qb_subject_idx ON public.question_bank (subject);
CREATE INDEX IF NOT EXISTS qb_chapter_idx ON public.question_bank (chapter);
CREATE INDEX IF NOT EXISTS qb_difficulty_idx ON public.question_bank (difficulty);
CREATE INDEX IF NOT EXISTS qb_type_idx ON public.question_bank (type);
CREATE INDEX IF NOT EXISTS qb_bloom_idx ON public.question_bank (bloom_level);
CREATE INDEX IF NOT EXISTS qb_concept_idx ON public.question_bank (concept_tag);
CREATE INDEX IF NOT EXISTS qb_source_kind_idx ON public.question_bank (source_kind);
CREATE INDEX IF NOT EXISTS qb_source_checked_at_idx ON public.question_bank (source_checked_at DESC);
CREATE INDEX IF NOT EXISTS qb_agent_run_id_idx ON public.question_bank (agent_run_id);
CREATE UNIQUE INDEX IF NOT EXISTS qb_unique_normalized_question_per_chapter_idx
  ON public.question_bank (board, class_name, subject, chapter, normalized_question);

-- 4. Visitor counter / analytics performance indexes
CREATE INDEX IF NOT EXISTS analytics_events_type_idx ON public.analytics_events (event_type);
CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON public.analytics_events (created_at DESC);
