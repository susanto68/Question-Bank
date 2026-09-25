-- Gives the promotion pipeline something to upsert against.
--
-- exact_hash is a digest of board|class|subject|question, so the same board
-- question extracted from two paper sets (the boards reuse questions across
-- sets) collapses to one row instead of being published repeatedly.
--
-- Rows predating the pipeline have a null exact_hash. Postgres treats nulls as
-- distinct in a unique index, so those rows are unaffected. The index is NOT
-- partial: PostgREST infers an ON CONFLICT target from the column alone and
-- cannot match a predicate.
drop index if exists public.question_bank_exact_hash_key;

create unique index if not exists question_bank_exact_hash_key
  on public.question_bank (exact_hash);
