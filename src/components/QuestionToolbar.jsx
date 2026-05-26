import { Copy, FileDown, Printer, Search } from 'lucide-react';
import { useState } from 'react';

import { copyQuestions, printQuestions } from '../utils/exportQuestions.js';
import { useQuestionStore } from '../store/questionStore.js';

export default function QuestionToolbar({ result, total }) {
  const { query, setQuery } = useQuestionStore();
  const [copied, setCopied] = useState(false);
  const sourceLabel = result.source === 'supabase'
    ? 'Supabase cache'
    : result.savedToSupabase
      ? 'Saved to Supabase'
      : result.source === 'cache'
        ? 'Firestore cache'
        : result.source === 'starter'
          ? 'Starter set'
          : 'Gemini';

  async function handleCopy() {
    await copyQuestions(result);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="no-print border-b border-white/10 bg-slate-950/10 p-2 sm:p-4">
      <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between">
        <label className="flex min-h-10 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-slate-950/45 px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:min-h-11">
          <Search size={16} className="shrink-0 text-cyan-200 sm:size-[18px]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search generated questions"
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          />
        </label>
        <div className="thin-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1 sm:gap-2 sm:pb-0">
          <span className="shrink-0 rounded-xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 px-2.5 py-2 text-[10px] font-bold text-slate-200 sm:px-3 sm:text-xs">
            {total} shown - {sourceLabel}
          </span>
          <button
            type="button"
            onClick={printQuestions}
            title="Export PDF"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-violet-300/20 to-fuchsia-400/15 text-slate-100 shadow-[0_5px_0_rgba(2,6,23,0.65)] hover:bg-white/10 sm:h-11 sm:w-11"
          >
            <FileDown size={18} />
          </button>
          <button
            type="button"
            onClick={printQuestions}
            title="Print"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-amber-300/20 to-orange-400/15 text-slate-100 shadow-[0_5px_0_rgba(2,6,23,0.65)] hover:bg-white/10 sm:h-11 sm:w-11"
          >
            <Printer size={18} />
          </button>
          <button
            type="button"
            onClick={handleCopy}
            title="Copy"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-gradient-to-br from-cyan-300/25 to-emerald-300/15 px-2.5 text-xs font-black text-cyan-50 shadow-[0_5px_0_rgba(2,6,23,0.65)] hover:bg-cyan-200/20 sm:h-11 sm:gap-2 sm:px-3 sm:text-sm"
          >
            <Copy size={18} />
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
