import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

const difficultyClasses = {
  Easy: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100',
  Medium: 'border-amber-300/30 bg-amber-300/10 text-amber-100',
  Hard: 'border-rose-300/30 bg-rose-300/10 text-rose-100',
};

function MarkdownBlock({ children }) {
  return (
    <div className="question-markdown thin-scrollbar overflow-x-auto text-[17px] leading-8 text-slate-100 sm:text-lg">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

export default function QuestionCard({ question, index }) {
  return (
    <article className="h-full overflow-hidden rounded-lg border border-white/10 bg-slate-950/38 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">Question {index + 1}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold text-slate-200">
              {question.type}
            </span>
            <span className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${difficultyClasses[question.difficulty] || difficultyClasses.Medium}`}>
              {question.difficulty}
            </span>
          </div>
        </div>
      </div>

      <div className="thin-scrollbar mt-4 h-[142px] overflow-auto rounded-lg border border-white/10 bg-white/[0.035] p-3">
        <MarkdownBlock>{question.question}</MarkdownBlock>
      </div>

      {question.options?.length ? (
        <div className="thin-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {question.options.map((option, optionIndex) => (
            <span
              key={`${option}-${optionIndex}`}
              className="min-w-[160px] rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-slate-200"
            >
              {String.fromCharCode(65 + optionIndex)}. {option}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="thin-scrollbar h-[86px] overflow-auto rounded-lg border border-emerald-300/15 bg-emerald-300/[0.06] p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-200">Answer</p>
          <MarkdownBlock>{question.answer}</MarkdownBlock>
        </div>
        <div className="thin-scrollbar h-[86px] overflow-auto rounded-lg border border-white/10 bg-white/[0.035] p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Explanation</p>
          <MarkdownBlock>{question.explanation || 'No explanation provided.'}</MarkdownBlock>
        </div>
      </div>
    </article>
  );
}
