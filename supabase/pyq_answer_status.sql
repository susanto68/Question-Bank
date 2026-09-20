-- Records how much trust a published answer carries.
--
-- CBSE publishes an official marking scheme for every board paper, so a CBSE
-- MCQ answer can be traced to the board's own document. CISCE publishes no
-- ICSE answer key at all, so an ICSE question can be genuine and source-linked
-- while its answer is only a draft awaiting review. Without this distinction
-- the two would look identical to a student.
--
--   official_marking_scheme : answer copied verbatim from the board's marking scheme
--   unverified_draft        : model-drafted, NOT from the board, pending human review
--   human_reviewed          : a reviewer has confirmed the answer
--   missing                 : no answer available; question shown for practice only

alter table public.question_bank
  add column if not exists answer_status text not null default 'missing';

alter table public.question_bank
  drop constraint if exists question_bank_answer_status_check;

alter table public.question_bank
  add constraint question_bank_answer_status_check
  check (answer_status in ('official_marking_scheme', 'unverified_draft', 'human_reviewed', 'missing'));

-- Existing AI-generated rows were never board-sourced; label them honestly
-- rather than leaving them indistinguishable from reviewed content.
update public.question_bank
   set answer_status = 'unverified_draft'
 where answer_status = 'missing'
   and answer is not null
   and length(trim(answer)) > 0;

create index if not exists question_bank_answer_status_idx
  on public.question_bank (board, class_name, subject, chapter, answer_status);
