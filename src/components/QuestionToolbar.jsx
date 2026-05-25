import { Copy, FileDown, Printer, Search } from 'lucide-react';
import { useState } from 'react';

import { copyQuestions, printQuestions } from '../utils/exportQuestions.js';
import { useQuestionStore } from '../store/questionStore.js';

export default function QuestionToolbar({ result, total }) {
  const { query, setQuery } = useQuestionStore();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await copyQuestions(result);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="no-print border-b border-white/10 p-3 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="flex min-h-11 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-slate-950/45 px-3">
          <Search size={18} className="shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search generated questions"
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          />
        </label>
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
            {total} shown - {result.source === 'cache' ? 'Firestore cache' : result.source === 'starter' ? 'Starter set' : 'Gemini'}
          </span>
          <button
            type="button"
            onClick={printQuestions}
            title="Export PDF"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
          >
            <FileDown size={18} />
          </button>
          <button
            type="button"
            onClick={printQuestions}
            title="Print"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
          >
            <Printer size={18} />
          </button>
          <button
            type="button"
            onClick={handleCopy}
            title="Copy"
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-cyan-200/10 px-3 text-sm font-bold text-cyan-100 hover:bg-cyan-200/20"
          >
            <Copy size={18} />
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
