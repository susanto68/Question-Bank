import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, GraduationCap, Home, Menu, Sparkles } from 'lucide-react';

import CommentCenter from './CommentCenter.jsx';
import InstallButton from './InstallButton.jsx';
import { boards } from '../data/catalog.js';

function SidebarButton({ board, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={board.name}
      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-[11px] font-black transition duration-200 active:translate-y-1 sm:h-11 sm:w-11 sm:text-xs ${
        active
          ? `border-white/35 bg-gradient-to-br ${board.accent} text-slate-950 shadow-[0_10px_0_rgba(8,13,28,0.55),0_18px_34px_rgba(34,211,238,0.22)]`
          : 'border-white/10 bg-slate-900/80 text-slate-200 shadow-[0_7px_0_rgba(2,6,23,0.7),0_14px_26px_rgba(0,0,0,0.28)] hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/10'
      }`}
    >
      {board.short}
    </button>
  );
}

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeBoard = boards.find((board) => location.pathname.includes(`/board/${board.id}`));

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      <aside className="no-print hidden w-[76px] shrink-0 flex-col items-center gap-3 border-r border-white/10 bg-slate-950/45 px-2 py-3 backdrop-blur-2xl sm:flex">
        <button
          type="button"
          onClick={() => navigate('/')}
          title="Home"
          className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-slate-700 to-slate-950 text-cyan-100 shadow-[0_7px_0_rgba(2,6,23,0.75),0_15px_24px_rgba(0,0,0,0.3)] transition active:translate-y-1 sm:h-11 sm:w-11"
        >
          <Home size={19} />
        </button>
        <div className="h-px w-9 bg-white/10" />
        <div className="thin-scrollbar flex flex-1 flex-col items-center gap-2 overflow-y-auto">
          {boards.map((board) => (
            <SidebarButton
              key={board.id}
              board={board}
              active={activeBoard?.id === board.id}
              onClick={() => navigate(`/board/${board.id}`)}
            />
          ))}
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="no-print flex min-h-[60px] shrink-0 items-center justify-between gap-1.5 border-b border-white/10 bg-slate-950/18 px-2 py-2 backdrop-blur-xl sm:min-h-20 sm:gap-2 sm:px-6 sm:py-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div className="relative h-10 w-10 shrink-0 rounded-2xl bg-gradient-to-br from-cyan-300 via-emerald-300 to-amber-300 p-[2px] shadow-[0_6px_0_rgba(2,6,23,0.65),0_13px_26px_rgba(34,211,238,0.18)] sm:h-16 sm:w-16 sm:shadow-[0_10px_0_rgba(2,6,23,0.65),0_22px_42px_rgba(34,211,238,0.18)]">
              <img
                src="/susanto-ganguly.png"
                alt="Susanto Ganguly"
                className="h-full w-full rounded-[14px] object-cover object-top"
              />
              <div className="absolute -bottom-1 -right-1 hidden h-6 w-6 place-items-center rounded-lg border border-white/20 bg-slate-950 text-cyan-200 shadow-lg sm:grid">
                <Sparkles size={13} />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-[8px] font-bold uppercase tracking-[0.11em] text-cyan-200 sm:text-[11px] sm:tracking-[0.18em]">Susanto Ganguly</p>
              <h1 className="truncate text-[15px] font-black tracking-normal leading-5 sm:text-2xl">AI Question Bank</h1>
              <p className="hidden truncate text-xs text-slate-400 sm:block">Smart board-wise question generator</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div className="hidden items-center gap-2 text-xs text-slate-300 lg:flex">
              <span className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <BookOpen size={14} /> 100 Questions
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <GraduationCap size={14} /> Mobile Ready
              </span>
            </div>
            <InstallButton />
            <CommentCenter />
          </div>
          <Menu className="hidden text-slate-400 sm:hidden" size={21} />
        </header>

        <div className="min-h-0 flex-1 overflow-hidden p-1.5 sm:p-5">
          <div className="glass h-full overflow-hidden rounded-[18px] sm:rounded-xl">
            <Outlet />
          </div>
        </div>

        <nav className="no-print flex h-[58px] shrink-0 items-center gap-1.5 border-t border-white/10 bg-slate-950/55 px-2 py-1.5 backdrop-blur-2xl sm:hidden">
          <button
            type="button"
            onClick={() => navigate('/')}
            title="Home"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-slate-700 to-slate-950 text-cyan-100 shadow-[0_5px_0_rgba(2,6,23,0.75)] active:translate-y-1"
          >
            <Home size={18} />
          </button>
          <div className="thin-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1">
            {boards.map((board) => (
              <SidebarButton
                key={board.id}
                board={board}
                active={activeBoard?.id === board.id}
                onClick={() => navigate(`/board/${board.id}`)}
              />
            ))}
          </div>
        </nav>
      </main>
    </div>
  );
}
