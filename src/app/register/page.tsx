'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { boards, getClasses, getSubjects } from '@/data/catalog';
import { Sparkles, ClipboardCheck, ArrowLeft, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function RegisterProfile() {
  const router = useRouter();
  const { user, studentProfile, loading, updateStudentProfile } = useAuthStore();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [board, setBoard] = useState('');
  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
    // Auto-fill existing details if any
    if (studentProfile) {
      setName(studentProfile.name || '');
      setPhone(studentProfile.phone || '');
      setBoard(studentProfile.board || '');
      setClassName(studentProfile.class_name || '');
      setSubject(studentProfile.subject || '');
    }
  }, [user, studentProfile, loading, router]);

  // Handle dynamic dropdown items
  const classesList = useMemo(() => {
    if (!board) return [];
    return getClasses(board.toLowerCase());
  }, [board]);

  const subjectsList = useMemo(() => {
    if (!board || !className) return [];
    return getSubjects(board.toLowerCase(), className);
  }, [board, className]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setSubmitting(true);

    try {
      const payload = {
        id: user.uid,
        email: user.email || '',
        name,
        phone,
        board,
        class_name: className,
        subject,
      };

      const success = await updateStudentProfile(payload);
      if (success) {
        // Go back to landing/selection
        router.push('/');
      } else {
        throw new Error('Failed to update student profile in Supabase.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while saving your profile.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="grid h-screen place-items-center bg-[#050816] text-white">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-cyan-200 text-sm">LOADING REGISTER SYSTEM...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8 text-white bg-slate-950">
      {/* Background gradients */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute h-[500px] w-[500px] bg-purple-600 rounded-full blur-[120px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
      </div>

      <div className="w-full max-w-lg z-10 space-y-6">
        <div className="text-center">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 via-sky-400 to-violet-400 p-[2px] shadow-[0_10px_24px_rgba(34,211,238,0.2)] mx-auto mb-4"
          >
            <div className="h-full w-full rounded-[14px] bg-[#050816] grid place-items-center text-cyan-200">
              <ClipboardCheck size={24} />
            </div>
          </motion.div>
          <h2 className="text-3xl font-black tracking-tight bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-400 bg-clip-text text-transparent">
            STUDENT PROFILE
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Setup your curriculum parameters permanently
          </p>
        </div>

        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-3xl border border-white/12 p-6 sm:p-8 relative overflow-hidden"
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-400" />
          
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-wider">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 text-white outline-none focus:border-cyan-200/60 text-sm"
                placeholder="e.g. Susanto Ganguly"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-wider">Phone Number (10 digits)</label>
              <input
                type="text"
                required
                pattern="\d{10}"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="mt-1.5 h-12 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 text-white outline-none focus:border-cyan-200/60 text-sm"
                placeholder="e.g. 9835379900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase text-slate-400 tracking-wider">Board / Category</label>
                <select
                  required
                  value={board}
                  onChange={(e) => {
                    setBoard(e.target.value);
                    setClassName('');
                    setSubject('');
                  }}
                  className="mt-1.5 h-12 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-white outline-none focus:border-cyan-200/60 text-sm cursor-pointer"
                >
                  <option value="">Select Board</option>
                  {boards.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-400 tracking-wider">Class / Grade</label>
                <select
                  required
                  disabled={!board}
                  value={className}
                  onChange={(e) => {
                    setClassName(e.target.value);
                    setSubject('');
                  }}
                  className="mt-1.5 h-12 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-white outline-none focus:border-cyan-200/60 text-sm cursor-pointer disabled:opacity-50"
                >
                  <option value="">Select Class</option>
                  {classesList.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-400 tracking-wider">Default Subject</label>
              <select
                required
                disabled={!className}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1.5 h-12 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-white outline-none focus:border-cyan-200/60 text-sm cursor-pointer disabled:opacity-50"
              >
                <option value="">Select Subject</option>
                {subjectsList.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="p-3 text-xs rounded-xl border border-rose-300/20 bg-rose-300/10 text-rose-300">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={() => router.push('/')}
                className="flex-1 inline-flex h-12 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 text-slate-200 font-bold hover:bg-white/10 cursor-pointer text-sm"
              >
                <ArrowLeft size={16} /> Cancel
              </button>
              
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 inline-flex h-12 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-cyan-300 via-sky-300 to-violet-400 text-slate-950 font-black shadow-[0_8px_0_rgba(2,6,23,0.7)] transition active:translate-y-1 disabled:opacity-60 cursor-pointer text-sm"
              >
                {submitting ? 'Saving...' : 'Register Profile'} <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </main>
  );
}
