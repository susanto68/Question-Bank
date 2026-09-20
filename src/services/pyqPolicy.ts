/**
 * Policy boundary for genuine previous-year questions (PYQs).
 *
 * Models may assist with OCR cleanup, page classification, syllabus tagging,
 * and anomaly detection. They never create a PYQ stem, decide a source is
 * official, or publish a record.
 *
 * One scoped exception exists for answers. CISCE publishes no ICSE answer key,
 * so an ICSE answer is drafted by selecting among the options the board itself
 * printed. Such rows are stored as answer_status = 'unverified_draft' and shown
 * to students with an "Unverified" badge until a reviewer confirms them. A
 * drafted answer is never labelled official. See
 * docs/board-question-bank-architecture.md.
 */
export const PYQ_ELIGIBLE_DOCUMENT_KINDS = new Set(['question_paper', 'previous_year_paper']);
export const PYQ_RESEARCH_ONLY_DOCUMENT_KINDS = new Set([
  'sample_paper',
  'specimen_paper',
  'marking_scheme',
  'answer_key',
  'syllabus',
]);

export type PyqModelRole = 'ocr_cleanup' | 'classification' | 'anomaly_review' | 'explanation';

export const pyqModelRoles: Record<PyqModelRole, string> = {
  // Kept configurable: these are Groq model IDs, not a claim that a model is
  // free or that it can certify an official paper.
  ocr_cleanup: process.env.GROQ_OCR_MODEL || 'qwen/qwen3.8-27b',
  classification: process.env.GROQ_CLASSIFIER_MODEL || 'openai/gpt-oss-20b',
  anomaly_review: process.env.GROQ_REVIEW_MODEL || 'qwen/qwen3.6-27b',
  explanation: process.env.GEMINI_EXPLANATION_MODEL || 'gemini-2.5-flash',
};

export function isEligiblePyqDocument(input: {
  official_source?: boolean | null;
  source_kind?: string | null;
  source_year?: number | null;
}, allowedYears: number[]): boolean {
  return input.official_source === true &&
    PYQ_ELIGIBLE_DOCUMENT_KINDS.has(String(input.source_kind || '').trim().toLowerCase()) &&
    allowedYears.includes(Number(input.source_year));
}

export function pyqModelInstruction(role: PyqModelRole): string {
  return [
    `Role: ${role}.`,
    'Return structured observations only.',
    'Do not rewrite, create, complete, or answer a question when the source is incomplete.',
    'Do not state that content is genuine, official, previous-year, or ready to publish.',
    'Return source spans, confidence, and a needs_human_review flag for every uncertain field.',
  ].join(' ');
}
