import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function StepHeader({ title, subtitle, steps = [] }) {
  const navigate = useNavigate();

  return (
    <div className="no-print border-b border-white/10 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
          title="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-black sm:text-2xl">{title}</h2>
          <p className="truncate text-sm text-slate-400">{subtitle}</p>
        </div>
      </div>
      <div className="thin-scrollbar flex gap-2 overflow-x-auto pb-1">
        {steps.map((step, index) => (
          <div
            key={`${step}-${index}`}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300"
          >
            <span>{step}</span>
            {index < steps.length - 1 ? <ChevronRight size={13} className="text-slate-500" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
