'use client';

import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import type { Question } from '@/services/ai';
import 'katex/dist/katex.min.css';

interface QuestionCardProps {
  question: Question;
  index: number;
}

const difficultyClasses: Record<string, string> = {
  Easy: 'border-emerald-200/45 bg-emerald-300/15 text-emerald-50',
  Medium: 'border-amber-200/45 bg-amber-300/15 text-amber-50',
  Hard: 'border-rose-200/45 bg-rose-300/15 text-rose-50',
};

const typeClasses: Record<string, string> = {
  MCQ: 'from-cyan-300 to-blue-400',
  'Fill in the Blanks': 'from-amber-300 to-yellow-400',
  'One Word': 'from-lime-300 to-emerald-400',
  'Full Forms': 'from-indigo-300 to-sky-400',
  'Assertion Reason': 'from-pink-300 to-rose-400',
  'Very Short Answer': 'from-teal-300 to-cyan-400',
  'Short Answer': 'from-emerald-300 to-teal-400',
  'Medium Answer': 'from-orange-300 to-red-400',
  'Long Answer': 'from-violet-300 to-fuchsia-400',
};

function MarkdownBlock({ children }: { children: string }) {
  return (
    <div className="question-markdown thin-scrollbar overflow-x-auto text-[14px] leading-6 text-slate-50 sm:text-[17px] sm:leading-7">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

export default function QuestionCard({ question, index }: QuestionCardProps) {
  return (
    <article className="relative h-full overflow-hidden rounded-2xl border border-white/12 bg-slate-950/58 p-2.5 shadow-[0_7px_0_rgba(2,6,23,0.62),0_16px_28px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-4 sm:shadow-[0_10px_0_rgba(2,6,23,0.62),0_22px_38px_rgba(0,0,0,0.3)]">
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${typeClasses[question.type] || 'from-cyan-300 to-blue-400'}`} />
      <div className="flex items-start justify-between gap-2 pt-1">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-cyan-100">Question {index + 1}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className={`rounded-lg bg-gradient-to-br px-2 py-1 text-[11px] font-black text-slate-950 ${typeClasses[question.type] || 'from-cyan-300 to-blue-400'}`}>
              {question.type}
            </span>
            <span className={`rounded-lg border px-2 py-1 text-[11px] font-black ${difficultyClasses[question.difficulty] || difficultyClasses.Medium}`}>
              {question.difficulty}
            </span>
          </div>
        </div>
      </div>

      <div className="thin-scrollbar mt-2 h-[112px] overflow-auto rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.11] to-white/[0.04] p-2.5 sm:mt-4 sm:h-[132px] sm:p-3">
        <MarkdownBlock>{question.question}</MarkdownBlock>
      </div>

      {question.options?.length ? (
        <div className="thin-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-1 sm:mt-3 sm:gap-2">
          {question.options.map((option, optionIndex) => (
            <span
              key={`${option}-${optionIndex}`}
              className="min-w-[138px] rounded-xl border border-white/10 bg-white/[0.07] px-2.5 py-1.5 text-xs font-semibold text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:min-w-[160px] sm:px-3 sm:py-2 sm:text-sm"
            >
              {String.fromCharCode(65 + optionIndex)}. {option}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-2 grid gap-2 sm:mt-3 sm:grid-cols-2 sm:gap-3">
        <div className="thin-scrollbar h-[70px] overflow-auto rounded-xl border border-emerald-300/20 bg-emerald-300/[0.08] p-2.5 sm:h-[82px] sm:p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100 sm:text-xs">Answer</p>
          <MarkdownBlock>{question.answer}</MarkdownBlock>
        </div>
        <div className="thin-scrollbar h-[70px] overflow-auto rounded-xl border border-cyan-300/15 bg-cyan-300/[0.06] p-2.5 sm:h-[82px] sm:p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100 sm:text-xs">Explanation</p>
          <MarkdownBlock>{question.explanation || 'No explanation provided.'}</MarkdownBlock>
        </div>
      </div>
    </article>
  );
}
