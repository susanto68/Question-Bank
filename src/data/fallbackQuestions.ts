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
        options: ['Core concept', 'Unrelated statement', 'Guesswork only', 'No relation'],
        answer: 'Core concept',
        explanation: 'Shown instantly as a starter question while live generation is unavailable.',
        marks,
        estimated_time
      };
    }

    if (type === 'True/False') {
      return {
        id: index + 1,
        type,
        difficulty,
        bloom_level,
        concept_tag: `${payload.chapter} Fundamentals`,
        learning_outcome: `Evaluate core definitions of ${payload.chapter}`,
        question: `True or False: Strong basics in **${payload.chapter}** help solve application-based questions.`,
        options: ['True', 'False'],
        answer: 'True',
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
