import type { Question } from '@/services/ai';

/** CBSE and ICSE are the first evidence-only board releases. */
export const VERIFIED_BOARD_IDS = new Set(['CBSE', 'ICSE']);
export const OFFICIAL_PAPER_KINDS = new Set(['question_paper', 'previous_year_paper']);

export type VerifiedQuestion = Question & { official_source?: boolean };

export function rollingBoardPaperYears(now = new Date()): number[] {
  const year = now.getUTCFullYear();
  return Array.from({ length: 5 }, (_, index) => year - index);
}

export function requiresVerifiedBoardPapers(board: string): boolean {
  return VERIFIED_BOARD_IDS.has(board.trim().toUpperCase());
}

export function isVerifiedBoardPaper(question: VerifiedQuestion, now = new Date()): boolean {
  const years = rollingBoardPaperYears(now);
  return question.official_source === true &&
    Boolean(question.source_url) &&
    OFFICIAL_PAPER_KINDS.has(String(question.source_kind || '').trim().toLowerCase()) &&
    Array.isArray(question.source_years) &&
    question.source_years.some((year) => years.includes(Number(year)));
}

export function notPublishedMessage(board: string, className: string, subject: string, chapter: string): string {
  const years = rollingBoardPaperYears().join('–');
  return `${board} ${className} ${subject} — ${chapter} is not published yet. Only verified official board-paper questions from ${years} are shown here; the research queue must extract, validate, and approve this chapter first.`;
}
