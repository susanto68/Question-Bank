import type { Question } from '@/services/ai';

const fallbackTypes = [
  'MCQ',
  'Fill in the Blanks',
  'One Word',
  'Full Forms',
  'Assertion Reason',
  'Very Short Answer',
  'Short Answer',
  'Medium Answer',
  'Long Answer',
];
const fallbackDifficulties = ['Easy', 'Medium', 'Hard'];
const assertionReasonOptions = [
  'Both A and R are true and R is the correct explanation.',
  'Both A and R are true but R is not the correct explanation.',
  'A is true but R is false.',
  'A is false but R is true.',
];

export interface FallbackPayload {
  board: string;
  className: string;
  subject: string;
  chapter: string;
}

export interface FallbackResult {
  source: 'starter';
  model: 'client-fallback';
  title: string;
  board: string;
  className: string;
  subject: string;
  chapter: string;
  questions: Question[];
  generatedAt: string;
  resilient: boolean;
  notice?: string;
}

export function buildClientFallbackQuestions(payload: FallbackPayload, count = 24): Question[] {
  return Array.from({ length: count }, (_, index) => {
    const type = fallbackTypes[index % fallbackTypes.length];
    const difficulty = fallbackDifficulties[index % fallbackDifficulties.length];
    const base = `${payload.chapter} in ${payload.subject}`;

    const bloom_level = difficulty === 'Easy' ? 'Remember' : difficulty === 'Medium' ? 'Understand' : 'Apply';
    const marks = difficulty === 'Easy' ? 1 : difficulty === 'Medium' ? 2 : 4;
    const estimated_time = difficulty === 'Easy' ? 60 : difficulty === 'Medium' ? 120 : 240;

    if (type === 'MCQ') {
      return {
        id: index + 1,
        type,
        difficulty,
        bloom_level,
        concept_tag: `${payload.chapter} Core Idea`,
        learning_outcome: `Evaluate foundational understanding of ${payload.chapter}`,
        question: `Which option best describes an important concept from **${base}**?`,
        options: ['Core concept', 'Applied method', 'Related example', 'Valid comparison'],
        answer: 'Core concept',
        explanation: 'Shown instantly as a starter question while live generation is unavailable.',
        marks,
        estimated_time
      };
    }

    if (type === 'Assertion Reason') {
      return {
        id: index + 1,
        type,
        difficulty,
        bloom_level,
        concept_tag: `${payload.chapter} Fundamentals`,
        learning_outcome: `Evaluate core definitions of ${payload.chapter}`,
        question: `Assertion (A): Strong basics in **${payload.chapter}** help solve application-based questions.\n\nReason (R): Conceptual clarity helps connect known facts with the required answer.`,
        options: assertionReasonOptions,
        answer: assertionReasonOptions[0],
        explanation: 'Shown instantly as a starter question while live generation is unavailable.',
        marks,
        estimated_time
      };
    }

    return {
      id: index + 1,
      type,
      difficulty,
      bloom_level,
      concept_tag: `${payload.chapter} Application`,
      learning_outcome: `Apply ${payload.chapter} methods to solve problems`,
      question: `Answer a ${difficulty.toLowerCase()} ${type} question on **${base}** with clear reasoning.`,
      options: [],
      answer: `Explain the key idea, add one example, and mention the final result clearly.`,
      explanation: 'Shown instantly as a starter question while live generation is unavailable.',
      marks,
      estimated_time
    };
  });
}

export function buildClientFallbackResult(payload: FallbackPayload, errorMessage = ''): FallbackResult {
  return {
    source: 'starter',
    model: 'client-fallback',
    title: `${payload.board} ${payload.className} ${payload.subject}: ${payload.chapter}`,
    board: payload.board,
    className: payload.className,
    subject: payload.subject,
    chapter: payload.chapter,
    questions: buildClientFallbackQuestions(payload),
    generatedAt: new Date().toISOString(),
    resilient: true,
    notice: errorMessage,
  };
}
