import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function StepHeader({ title, subtitle, steps = [] }) {
  const navigate = useNavigate();

  return (
    <div className="no-print border-b border-white/10 bg-slate-950/10 p-2 sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-2 sm:mb-4 sm:gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-cyan-300/20 to-blue-400/10 text-slate-100 shadow-[0_5px_0_rgba(2,6,23,0.65)] transition hover:bg-white/10 sm:h-10 sm:w-10"
          title="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-black leading-5 sm:text-2xl sm:leading-8">{title}</h2>
          <p className="truncate text-[11px] text-slate-400 sm:text-sm">{subtitle}</p>
        </div>
      </div>
      <div className="thin-scrollbar flex gap-1 overflow-x-auto pb-1 sm:gap-2">
        {steps.map((step, index) => (
          <div
            key={`${step}-${index}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-slate-300 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs"
          >
            <span>{step}</span>
            {index < steps.length - 1 ? <ChevronRight size={13} className="text-slate-500" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
