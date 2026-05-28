import { GenerationResult } from '@/services/ai';

export function questionsToText(result: GenerationResult): string {
  if (!result?.questions?.length) {
    return '';
  }

  return result.questions
    .map((question, index) => {
      const options = question.options?.length ? `\nOptions:\n${question.options.map((option) => `- ${option}`).join('\n')}` : '';
      return `${index + 1}. [${question.type} | ${question.difficulty}] ${question.question}${options}\nAnswer: ${question.answer}\nExplanation: ${question.explanation || ''}`;
    })
    .join('\n\n');
}

export async function copyQuestions(result: GenerationResult): Promise<void> {
  await navigator.clipboard.writeText(questionsToText(result));
}

export function printQuestions(): void {
  if (typeof window !== 'undefined') {
    window.print();
  }
}
