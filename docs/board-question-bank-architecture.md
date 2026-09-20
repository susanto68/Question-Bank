# Board question bank: evidence-first architecture

## Non-negotiable publishing rule

A student-visible question must be traceable to one official board examination paper. It may be reformatted for accessibility, but the original document URL, paper year, board, class, subject, marks, answer source, and review result remain attached. AI may classify, OCR, explain, or propose tags; it must never create a row labelled as a genuine previous-year question.

For the first release, CBSE and ICSE accept only `question_paper` or `previous_year_paper` records whose `official_source` is true and whose `source_year` falls in the rolling five-year window. Sample/specimen papers are useful for pattern analysis but are not eligible for the genuine-question bank.

## Answer evidence differs by board

CBSE publishes an official marking scheme for every board paper, so a CBSE
answer is copied from the board's own document and stored as
`answer_status = official_marking_scheme`.

CISCE publishes ICSE question papers but **no answer key of any kind**. The
decision taken for this release is to still publish the genuine ICSE question
and label its answer honestly, rather than withhold ICSE or show a real question
with no answer. Those rows are stored as `answer_status = unverified_draft`,
rendered with an "Unverified" badge, and stay that way until a reviewer promotes
them to `human_reviewed`. This is a deliberate, scoped exception to the rule that
a model never fills a missing answer: the model chooses among options the board
itself printed, never writes a stem, and the result is never presented as
board-issued.

Two coverage facts are structural, not gaps in the pipeline:

- ICSE has no 2021 or 2022 papers. The 2021 exam was cancelled and 2022 ran as a
  two-semester format, so the ICSE window is 2023–2026.
- ISC (CISCE Class 12) papers are published as scans with no text layer and
  require OCR, which is flagged for review rather than auto-published.

## Data flow

```text
official syllabus + official paper index
  -> source_documents (checksum, year, board, class, subject)
  -> raw_extracted_questions (verbatim OCR/extraction; never shown)
  -> deterministic validation + human review
  -> question_bank + question_sources (student-visible, source-linked)
  -> source-only API -> responsive question viewer
```

## Required agent contract

Every board agent receives one board/class/subject/year batch and must:

1. Discover only official syllabus and paper-index URLs, then save each document with its checksum.
2. Confirm the requested chapter is present in that board's current syllabus before extracting a question.
3. Extract the question, marks, options, and answer-key/marking-scheme evidence separately. Preserve page number in the raw record or review notes.
4. Reject OCR with missing stem, uncertain answer, mixed questions, duplicate hash, wrong class, or no syllabus mapping.
5. Promote only reviewed rows, link every promoted row in `question_sources`, and keep `official_source=true`.
6. Report coverage by syllabus chapter and by each of the five years. A gap is a gap; do not invent a replacement question.

## Review gates

| Gate | Required evidence | Failure action |
| --- | --- | --- |
| Syllabus | Official syllabus URL and exact chapter match | Hold as off-syllabus |
| Authenticity | Official board domain, document year, checksum | Reject |
| Extraction | Complete stem/options/marks and page-level review | Hold for OCR review |
| Answer | Official marking scheme or independently reviewed solution | Hold for answer review |
| Duplicate | Exact hash plus semantic similarity check | Merge sources or reject |
| Publication | `official_source`, source URL, `question_paper` kind, rolling-five-year value | Do not expose |

## Board manifests

Agents begin from `research/boards/cbse/source-manifest.json` and `research/boards/icse/source-manifest.json`. A manifest is a discovery plan, not proof that every linked document has passed review. Update a URL only after an agent can fetch it and record a checksum.

## Coverage definition

“Complete” means every selectable syllabus chapter has the board-set target number of approved questions, every student-visible answer has evidence, and the coverage report includes all five source years where official papers were available. It does not mean filling a chapter to 100 with generated questions.
