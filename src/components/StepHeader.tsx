'use client';

import { ArrowLeft, ChevronRight, FileText, Bot, Briefcase, Users, Library } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface StepHeaderProps {
  title: string;
  subtitle: string;
  steps?: string[];
}

export default function StepHeader({ title, subtitle, steps = [] }: StepHeaderProps) {
  const router = useRouter();

  const linkButtons = [
    {
      name: "Sir Ganguly's Notes",
      url: "https://sirganguly.com",
      icon: <FileText size={13} />,
      gradient: "from-rose-400 via-pink-400 to-red-500",
      shadow: "shadow-[0_4px_0_#9f1239] active:shadow-[0_1px_0_#9f1239]",
    },
    {
      name: "AI Avatar",
      url: "https://ai.sirganguly.com",
      icon: <Bot size={13} />,
      gradient: "from-cyan-300 via-sky-400 to-violet-500",
      shadow: "shadow-[0_4px_0_#1e3a8a] active:shadow-[0_1px_0_#1e3a8a]",
    },
    {
      name: "Career/Job",
      url: "https://career.sirganguly.com",
      icon: <Briefcase size={13} />,
      gradient: "from-emerald-300 via-teal-400 to-cyan-500",
      shadow: "shadow-[0_4px_0_#065f46] active:shadow-[0_1px_0_#065f46]",
    },
    {
      name: "Career/Mentor",
      url: "https://mentor.sirganguly.com",
      icon: <Users size={13} />,
      gradient: "from-amber-300 via-yellow-400 to-orange-500",
      shadow: "shadow-[0_4px_0_#9a3412] active:shadow-[0_1px_0_#9a3412]",
    },
    {
      name: "Library",
      url: "https://books.sirganguly.com",
      icon: <Library size={13} />,
      gradient: "from-fuchsia-400 via-purple-500 to-indigo-500",
      shadow: "shadow-[0_4px_0_#581c87] active:shadow-[0_1px_0_#581c87]",
    },
  ];

  return (
    <div className="no-print border-b border-white/10 bg-slate-950/10 p-2 sm:p-5">
      <div className="mb-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between sm:mb-4 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => router.back()}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-cyan-300/20 to-blue-400/10 text-slate-100 shadow-[0_5px_0_rgba(2,6,23,0.65)] transition active:translate-y-1 sm:h-10 sm:w-10 cursor-pointer"
            title="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-base font-black leading-5 sm:text-2xl sm:leading-8 text-white">{title}</h2>
            <p className="truncate text-[11px] text-slate-400 sm:text-sm">{subtitle}</p>
          </div>
        </div>

        {/* 5 Futuristic 3D Gradient Link Buttons */}
        <div className="flex flex-wrap items-center gap-2 justify-center lg:justify-end">
          {linkButtons.map((btn) => (
            <a
              key={btn.name}
              href={btn.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/20 bg-gradient-to-br ${btn.gradient} px-2.5 py-1 text-[10px] font-black text-slate-950 ${btn.shadow} transition hover:-translate-y-0.5 active:translate-y-1 duration-150 cursor-pointer uppercase tracking-wider`}
            >
              {btn.icon}
              <span>{btn.name}</span>
            </a>
          ))}
        </div>
      </div>
      <div className="thin-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1 sm:gap-2">
        {steps.map((step, index) => (
          <div key={`${step}-${index}`} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div
              className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-300 sm:rounded-xl sm:px-3.5 sm:py-2 sm:text-xs"
            >
              <span>{step}</span>
            </div>
            {index < steps.length - 1 ? <ChevronRight size={13} className="text-slate-500 shrink-0" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
