'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { boards } from '@/data/catalog';
import AppShell from '@/components/AppShell';
import SelectionGrid from '@/components/SelectionGrid';
import { Sparkles, Trophy, LayoutDashboard, LogIn, LogOut, Compass, Bot, Briefcase, FileText, Users, ArrowRight } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { user, studentProfile, logout } = useAuthStore();

  const handleSelectBoard = (item: any) => {
    router.push(`/board/${item.id}`);
  };

  const handleLaunchMockTest = () => {
    if (studentProfile?.board && studentProfile?.class_name && studentProfile?.subject) {
      const params = new URLSearchParams({
        board: studentProfile.board,
        class: studentProfile.class_name,
        subject: studentProfile.subject,
      });
      router.push(`/mock-test?${params.toString()}`);
    } else {
      router.push('/mock-test');
    }
  };

  return (
    <AppShell>
      <div className="flex h-full flex-col overflow-y-auto thin-scrollbar bg-[#050816]/30 text-white">
        
        {/* Futuristic Hero/Launchpad Section */}
        <section className="relative px-6 py-12 md:py-16 text-center space-y-6 shrink-0 overflow-hidden border-b border-white/5 bg-slate-950/20">
          {/* Neon background blur nodes */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 bg-cyan-400/10 rounded-full blur-[100px] pointer-events-none"></div>

          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 via-sky-300 to-violet-400 p-[1.5px] shadow-[0_8px_20px_rgba(34,211,238,0.18)] mx-auto mb-2"
          >
            <div className="h-full w-full rounded-[13px] bg-[#050816] grid place-items-center text-cyan-200">
              <Sparkles size={20} className="animate-pulse" />
            </div>
          </motion.div>

          <div className="max-w-2xl mx-auto space-y-3">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-none">
               QUESTION <span className="bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300 bg-clip-text text-transparent">BANK AI</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 uppercase tracking-[0.25em] font-semibold">
              futuristic educational learning ecosystem
            </p>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-lg mx-auto pt-2 font-medium">
              Explore dynamic board-wise structured question banks generated instantly by advanced AI. Unlock personalized evaluations and claim achievement credentials.
            </p>
          </div>

          {/* Quick launch controls */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              onClick={handleLaunchMockTest}
              className="inline-flex h-11 px-6 items-center justify-center gap-2 rounded-xl border border-white/20 bg-gradient-to-br from-emerald-300 via-teal-300 to-cyan-400 text-slate-950 font-black shadow-[0_5px_0_#047857] active:shadow-[0_1px_0_#047857] transition hover:-translate-y-0.5 active:translate-y-1 duration-150 cursor-pointer text-xs uppercase tracking-wider"
            >
              <Trophy size={16} /> Take Mock Test
            </button>

            {user ? (
              <>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="inline-flex h-11 px-6 items-center justify-center gap-2 rounded-xl border border-white/20 bg-gradient-to-br from-cyan-400 via-sky-400 to-blue-500 text-slate-950 font-black shadow-[0_5px_0_#1e3a8a] active:shadow-[0_1px_0_#1e3a8a] transition hover:-translate-y-0.5 active:translate-y-1 duration-150 cursor-pointer text-xs uppercase tracking-wider"
                >
                  <LayoutDashboard size={16} /> Dashboard
                </button>
                <button
                  onClick={logout}
                  className="inline-flex h-11 px-4 items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-gradient-to-br from-rose-400 via-pink-400 to-red-500 text-slate-950 font-black shadow-[0_5px_0_#9f1239] active:shadow-[0_1px_0_#9f1239] transition hover:-translate-y-0.5 active:translate-y-1 duration-150 cursor-pointer text-xs uppercase tracking-wider"
                >
                  <LogOut size={15} /> Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={() => router.push('/mock-test')}
                className="inline-flex h-11 px-6 items-center justify-center gap-2 rounded-xl border border-white/20 bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600 text-white font-black shadow-[0_5px_0_#1e293b] active:shadow-[0_1px_0_#1e293b] transition hover:-translate-y-0.5 active:translate-y-1 duration-150 cursor-pointer text-xs uppercase tracking-wider"
              >
                <LogIn size={16} /> Sign In
              </button>
            )}
          </div>
        </section>

        {/* Premium Ecosystem Future Portals */}
        <section className="p-2 sm:p-5 border-b border-white/5 bg-slate-950/10 no-print">
          <div className="ecosystem-grid-container" aria-label="Sir Ganguly Ecosystem portals">
            <h2 className="ecosystem-grid-title">Explore Sir Ganguly AI Ecosystem</h2>
            <div className="ecosystem-grid">
              <a 
                href="https://sirganguly.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="sg-hero-btn sg-btn-home"
              >
                <span className="sg-btn-icon">🏠</span>
                <span className="sg-btn-text">Home Portal</span>
              </a>
              <a 
                href="https://ai.sirganguly.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="sg-hero-btn sg-btn-ai"
              >
                <span className="sg-btn-icon">🤖</span>
                <span className="sg-btn-text">AI Teacher</span>
              </a>
              <a 
                href="/" 
                className="sg-hero-btn sg-btn-questions"
              >
                <span className="sg-btn-icon">❓</span>
                <span className="sg-btn-text">100 Question Bank</span>
              </a>
              <a 
                href="https://books.sirganguly.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="sg-hero-btn sg-btn-books"
              >
                <span className="sg-btn-icon">📚</span>
                <span className="sg-btn-text">Books Library</span>
              </a>
              <a 
                href="https://career.sirganguly.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="sg-hero-btn sg-btn-career"
              >
                <span className="sg-btn-icon">🚀</span>
                <span className="sg-btn-text">Career Placement</span>
              </a>
              <a 
                href="https://mentor.sirganguly.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="sg-hero-btn sg-btn-mentor"
              >
                <span className="sg-btn-icon">🎯</span>
                <span className="sg-btn-text">Meet Mentors</span>
              </a>
            </div>
          </div>
        </section>

        {/* Board Selection Grid - OPEN FOR ALL STUDENTS */}
        <section className="flex-1 p-2 sm:p-5">
          <div className="max-w-7xl mx-auto space-y-4">
            <div className="text-left px-2.5 sm:px-5">
              <span className="text-[10px] font-black uppercase text-cyan-200 tracking-widest">Syllabus Framework Selection</span>
              <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">CHOOSE YOUR BOARD</h3>
              <p className="text-xs text-slate-400 mt-0.5">Explore standard curriculum guides and generate instant chapter question banks.</p>
            </div>
            
            <SelectionGrid items={boards} onSelect={handleSelectBoard} />
          </div>
        </section>

      </div>
    </AppShell>
  );
}
