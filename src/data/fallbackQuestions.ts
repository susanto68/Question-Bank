import { Question } from '@/services/ai';

const fallbackTypes = ['MCQ', 'Short Answer', 'Long Answer', 'True/False', 'Assertion Reason', 'Numerical'];
const fallbackDifficulties = ['Easy', 'Medium', 'Hard'];

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

    if (type === 'MCQ') {
      return {
        id: index + 1,
        type,
        difficulty,
        question: `Which option best describes an important concept from **${base}**?`,
        options: ['Core concept', 'Unrelated statement', 'Guesswork only', 'No relation'],
        answer: 'Core concept',
        explanation: 'Shown instantly as a starter question while live generation is unavailable.',
      };
    }

    if (type === 'True/False') {
      return {
        id: index + 1,
        type,
        difficulty,
        question: `True or False: Strong basics in **${payload.chapter}** help solve application-based questions.`,
        options: ['True', 'False'],
        answer: 'True',
        explanation: 'Shown instantly as a starter question while live generation is unavailable.',
      };
    }

    return {
      id: index + 1,
      type,
      difficulty,
      question: `Answer a ${difficulty.toLowerCase()} ${type} question on **${base}** with clear reasoning.`,
      options: [],
      answer: `Explain the key idea, add one example, and mention the final result clearly.`,
      explanation: 'Shown instantly as a starter question while live generation is unavailable.',
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
