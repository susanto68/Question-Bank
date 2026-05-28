'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import AppShell from '@/components/AppShell';
import LoadingState from '@/components/LoadingState';
import { 
  Trophy, 
  Award, 
  Settings, 
  BookOpen, 
  Activity, 
  TrendingUp, 
  CheckCircle2, 
  ChevronRight,
  TrendingDown,
  Sparkles
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function StudentDashboard() {
  const router = useRouter();
  const { user, studentProfile, loading: authLoading, previousTests, certificates, loadTestHistory, loadCertificates } = useAuthStore();

  // Redirect to home if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    } else if (user) {
      loadTestHistory(user.uid);
      loadCertificates(user.uid);
    }
  }, [user, authLoading, router, loadTestHistory, loadCertificates]);

  // Performance analytics calculations
  const stats = useMemo(() => {
    if (!previousTests || previousTests.length === 0) {
      return {
        avgScore: 0,
        avgPercentage: 0,
        totalAttempts: 0,
        highestScore: 0,
        totalDuration: 0,
      };
    }

    let totalScore = 0;
    let highest = 0;
    let totalDur = 0;

    previousTests.forEach((test) => {
      totalScore += test.score;
      if (test.score > highest) highest = test.score;
      totalDur += test.duration_seconds;
    });

    const avg = totalScore / previousTests.length;

    return {
      avgScore: Number(avg.toFixed(1)),
      avgPercentage: Math.round((avg / 10) * 100),
      totalAttempts: previousTests.length,
      highestScore: highest,
      totalDuration: Math.round(totalDur / previousTests.length),
    };
  }, [previousTests]);

  // AI Strengths and Weakness recommendation architecture
  const strengthsAndWeaknesses = useMemo(() => {
    if (!previousTests || previousTests.length === 0) {
      return {
        strengths: ['Curriculum Onboarded', 'Ready to Start'],
        weaknesses: ['No tests taken yet. Launch a mock test to discover!'],
      };
    }

    const strengths = [];
    const weaknesses = [];

    // Analyze based on performance
    if (stats.avgPercentage >= 80) {
      strengths.push('Excellent concept recall', 'Consistent mock performance');
    } else if (stats.avgPercentage >= 50) {
      strengths.push('Active syllabus progression', 'Foundational concepts established');
      weaknesses.push('Targeted practice on high-difficulty MCQs', 'Review exam explanation blocks');
    } else {
      strengths.push('Syllabus targets configured');
      weaknesses.push('High concentration of incorrect MCQs', 'Increase preparation with chapter question bank reviews');
    }

    if (stats.totalDuration > 400) {
      weaknesses.push('Refine answering speed (Avg. duration is high)');
    } else if (stats.totalDuration > 0 && stats.totalDuration < 200) {
      strengths.push('Rapid question parsing pace');
    }

    return { strengths, weaknesses };
  }, [previousTests, stats]);

  if (authLoading) return <LoadingState label="Decrypting student profile..." />;

  return (
    <AppShell>
      <div className="flex h-full flex-col overflow-y-auto thin-scrollbar bg-[#050816]/30 text-white p-4 sm:p-6 space-y-6">
        {/* Profile Card & Parameters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl border border-white/10 bg-slate-950/45 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-300 via-sky-300 to-violet-400 p-[2px] shadow-lg shrink-0">
              <div className="h-full w-full rounded-[14px] bg-[#050816] grid place-items-center text-cyan-300 text-lg font-black uppercase">
                {studentProfile?.name?.slice(0, 2) || 'ST'}
              </div>
            </div>
            <div className="min-w-0 text-left">
              <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest">Syllabus Registry</span>
              <h2 className="text-xl sm:text-2xl font-black truncate">{studentProfile?.name || 'Student'}</h2>
              <p className="text-xs text-slate-400 truncate mt-0.5">{user?.email}</p>
            </div>
          </div>

          <div className="thin-scrollbar flex gap-2 overflow-x-auto pb-1 md:pb-0">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-1.5 text-xs text-left shrink-0">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Board</span>
              <span className="font-bold text-slate-200">{studentProfile?.board || 'None'}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-1.5 text-xs text-left shrink-0">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Class</span>
              <span className="font-bold text-slate-200">{studentProfile?.class_name || 'None'}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-1.5 text-xs text-left shrink-0">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">Subject</span>
              <span className="font-bold text-slate-200">{studentProfile?.subject || 'None'}</span>
            </div>
            <button
              onClick={() => router.push('/register')}
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 cursor-pointer shrink-0"
              title="Edit Profile Settings"
            >
              <Settings size={17} />
            </button>
          </div>
        </div>

        {/* Analytics stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="glass p-4 rounded-2xl border border-white/10 text-left space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Mock Tests</span>
              <BookOpen size={16} />
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white">{stats.totalAttempts}</h3>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Attempts Taken</p>
          </div>

          <div className="glass p-4 rounded-2xl border border-white/10 text-left space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Average Score</span>
              <TrendingUp size={16} className="text-cyan-300" />
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white">{stats.avgPercentage}%</h3>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Average Percentage</p>
          </div>

          <div className="glass p-4 rounded-2xl border border-white/10 text-left space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Certificates</span>
              <Award size={16} className="text-yellow-300" />
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white">{certificates.length}</h3>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Earned Achievements</p>
          </div>

          <div className="glass p-4 rounded-2xl border border-white/10 text-left space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Highest Score</span>
              <Trophy size={16} className="text-emerald-300" />
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white">{stats.highestScore} / 10</h3>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Personal High Score</p>
          </div>
        </div>

        {/* Strengths and Weaknesses & AI recommendation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass p-5 rounded-2xl border border-white/10 text-left space-y-3">
            <h3 className="text-sm font-black uppercase text-cyan-200 tracking-wider flex items-center gap-1.5">
              <TrendingUp size={16} /> Conceptual Strengths
            </h3>
            <ul className="space-y-2">
              {strengthsAndWeaknesses.strengths.map((str, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-200">
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-300" />
                  <span>{str}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass p-5 rounded-2xl border border-white/10 text-left space-y-3">
            <h3 className="text-sm font-black uppercase text-rose-300 tracking-wider flex items-center gap-1.5">
              <TrendingDown size={16} /> Recommendation Areas
            </h3>
            <ul className="space-y-2">
              {strengthsAndWeaknesses.weaknesses.map((weak, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-slate-300">
                  <Sparkles size={15} className="shrink-0 mt-0.5 text-yellow-300" />
                  <span>{weak}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Test Attempts History */}
        <div className="glass p-5 rounded-2xl border border-white/10 text-left space-y-4">
          <h3 className="text-sm font-black uppercase text-slate-200 tracking-wider flex items-center gap-1.5">
            <Activity size={16} /> Mock Evaluation History
          </h3>
          {previousTests && previousTests.length > 0 ? (
            <div className="overflow-x-auto thin-scrollbar">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="pb-3">Syllabus Scope</th>
                    <th className="pb-3">Attempt Date</th>
                    <th className="pb-3">Duration</th>
                    <th className="pb-3 text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {previousTests.map((test) => {
                    const testMins = Math.floor(test.duration_seconds / 60);
                    const testSecs = test.duration_seconds % 60;
                    const durationStr = `${testMins}m ${testSecs}s`;
                    const dateStr = new Date(test.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    });

                    return (
                      <tr key={test.id} className="text-slate-200">
                        <td className="py-3 pr-2">
                          <span className="font-bold block text-xs sm:text-sm">{test.subject}</span>
                          <span className="text-[10px] text-slate-500">{test.board} • {test.class_name}</span>
                        </td>
                        <td className="py-3 text-xs text-slate-400">{dateStr}</td>
                        <td className="py-3 text-xs text-slate-400">{durationStr}</td>
                        <td className="py-3 font-extrabold text-right text-emerald-300">
                          {test.score} / {test.total_questions}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-4">No evaluations recorded. Click Take Mock Test in Home to begin!</p>
          )}
        </div>

        {/* Certificates Grid */}
        <div className="glass p-5 rounded-2xl border border-white/10 text-left space-y-4">
          <h3 className="text-sm font-black uppercase text-yellow-300 tracking-wider flex items-center gap-1.5">
            <Award size={16} /> Achievement Certificates
          </h3>
          {certificates && certificates.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {certificates.map((cert) => (
                <div key={cert.id} className="rounded-xl border border-yellow-300/10 bg-yellow-300/5 p-4 flex justify-between items-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 h-16 w-16 bg-yellow-300/5 rounded-full blur-lg pointer-events-none"></div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-yellow-200 tracking-wide">{cert.subject}</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">{cert.board} • {cert.class_name}</p>
                    <p className="text-[10px] text-slate-500 mt-2 font-mono">ID: {cert.certificate_id}</p>
                  </div>
                  <button
                    onClick={() => router.push(`/certificate/${cert.id}`)}
                    className="h-9 px-3 text-[11px] font-black uppercase tracking-wider rounded-lg bg-yellow-300 text-slate-950 flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    View <ChevronRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-4">No certificates earned. Score 80% or higher in a Mock Test to claim one!</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
