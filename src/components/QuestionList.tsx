'use client';

import { Question } from '@/services/ai';
import QuestionCard from './QuestionCard';

interface QuestionListProps {
  questions: Question[];
}

export default function QuestionList({ questions }: QuestionListProps) {
  if (!questions.length) {
    return (
      <div className="grid h-full place-items-center p-8 text-center text-sm text-slate-400">
        No questions match the current search.
      </div>
    );
  }

  return (
    <div className="thin-scrollbar h-full overflow-y-auto px-2 py-1.5 sm:px-4 sm:py-2 space-y-4">
      {questions.map((question, index) => (
        <div
          key={question.id || index}
          className="w-full"
          style={{ contentVisibility: 'auto', containIntrinsicSize: '360px' }}
        >
          <QuestionCard question={question} index={index} />
        </div>
      ))}
    </div>
  );
}
