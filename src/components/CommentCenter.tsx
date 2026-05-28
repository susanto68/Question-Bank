'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Eye, MessageSquare, Send, ShieldCheck, X } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { boards } from '@/data/catalog';
import { sendAdminOtp, submitComment, verifyAdminOtp } from '@/services/api';

const adminPhone = '9835379900';

function normalizePhone(value: string) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

interface PanelProps {
  children: React.ReactNode;
  onClose: () => void;
}

function Panel({ children, onClose }: PanelProps) {
  return (
    <motion.div
      className="fixed inset-0 z-[9999] bg-slate-950/55 p-3 backdrop-blur-[3px] sm:p-5 flex justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        className="max-h-[calc(100dvh-24px)] w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-slate-950/92 shadow-[0_18px_0_rgba(2,6,23,0.68),0_38px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl flex flex-col"
        initial={{ opacity: 0, y: -16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function CommentForm({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const [form, setForm] = useState({ name: '', phone: '', board: '', comment: '' });
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(field: string, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setStatus('');

    try {
      await submitComment({ ...form, pagePath: pathname || '/' });
      setStatus('Comment submitted successfully.');
      setForm({ name: '', phone: '', board: '', comment: '' });
    } catch (error: any) {
      setStatus(error.message || 'Could not submit comment.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel onClose={onClose}>
      <div className="flex items-center justify-between border-b border-white/10 p-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Quick Comment</p>
          <h3 className="text-xl font-black text-white">Write your comment</h3>
        </div>
        <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-200 cursor-pointer">
          <X size={18} />
        </button>
      </div>
      <form onSubmit={onSubmit} className="thin-scrollbar flex-1 overflow-y-auto space-y-4 p-4">
        <Field label="Name">
          <input required value={form.name} onChange={(event) => update('name', event.target.value)} className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.08] px-3 text-white outline-none focus:border-cyan-200/60" />
        </Field>
        <Field label="Phone Number">
          <input required inputMode="numeric" value={form.phone} onChange={(event) => update('phone', event.target.value)} className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.08] px-3 text-white outline-none focus:border-cyan-200/60" />
        </Field>
        <Field label="Board">
          <select required value={form.board} onChange={(event) => update('board', event.target.value)} className="h-12 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-white outline-none focus:border-cyan-200/60">
            <option value="">Select board</option>
            {boards.map((board) => (
              <option key={board.id} value={board.name}>
                {board.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Comment">
          <textarea required value={form.comment} onChange={(event) => update('comment', event.target.value)} rows={5} className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.08] px-3 py-3 text-white outline-none focus:border-cyan-200/60" />
        </Field>
        {status ? <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-cyan-100">{status}</p> : null}
        <button disabled={submitting} type="submit" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-cyan-300 via-emerald-300 to-amber-300 font-black text-slate-950 shadow-[0_8px_0_rgba(2,6,23,0.7)] transition active:translate-y-1 disabled:opacity-60 cursor-pointer">
          <Send size={18} />
          {submitting ? 'Submitting...' : 'Submit Comment'}
        </button>
      </form>
    </Panel>
  );
}

function AdminPanel({ onClose }: { onClose: () => void }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone');
  const [status, setStatus] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const isAdminPhone = useMemo(() => normalizePhone(phone) === adminPhone, [phone]);

  async function sendOtp(event: React.FormEvent) {
    event.preventDefault();
    setStatus('');

    if (!isAdminPhone) {
      setStatus('For Admin only');
      return;
    }

    setLoading(true);

    try {
      const result = await sendAdminOtp(phone);
      setStep('otp');
      setStatus(result.fallback ? 'SMS is not enabled. Enter your private admin OTP.' : 'OTP sent to admin phone.');
    } catch (error: any) {
      setStatus(error.message || 'Could not send OTP.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setStatus('');

    try {
      const result = await verifyAdminOtp(phone, otp);
      setComments(result.comments || []);
      setStep('comments');
    } catch (error: any) {
      setStatus(error.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel onClose={onClose}>
      <div className="flex items-center justify-between border-b border-white/10 p-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-200">Admin Only</p>
          <h3 className="text-xl font-black text-white">Display comments</h3>
        </div>
        <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-200 cursor-pointer">
          <X size={18} />
        </button>
      </div>

      {step === 'phone' ? (
        <form onSubmit={sendOtp} className="space-y-4 p-4">
          <Field label="Admin Phone Number">
            <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="numeric" className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.08] px-3 text-white outline-none focus:border-amber-200/60" />
          </Field>
          {status ? <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-amber-100">{status}</p> : null}
          <button disabled={loading} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-amber-300 via-orange-300 to-rose-400 font-black text-slate-950 shadow-[0_8px_0_rgba(2,6,23,0.7)] transition active:translate-y-1 cursor-pointer">
            <ShieldCheck size={18} />
            {loading ? 'Sending OTP...' : 'Send OTP'}
          </button>
        </form>
      ) : null}

      {step === 'otp' ? (
        <form onSubmit={verifyOtp} className="space-y-4 p-4">
          <Field label="OTP">
            <input value={otp} onChange={(event) => setOtp(event.target.value)} inputMode="numeric" className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.08] px-3 text-white outline-none focus:border-amber-200/60" />
          </Field>
          {status ? <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-amber-100">{status}</p> : null}
          <button disabled={loading} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-amber-300 via-orange-300 to-rose-400 font-black text-slate-950 shadow-[0_8px_0_rgba(2,6,23,0.7)] transition active:translate-y-1 cursor-pointer">
            <Eye size={18} />
            {loading ? 'Checking...' : 'Display Comments'}
          </button>
        </form>
      ) : null}

      {step === 'comments' ? (
        <div className="thin-scrollbar flex-1 overflow-y-auto space-y-3 p-4">
          {comments.length ? (
            comments.map((comment) => (
              <article key={comment.id} className="rounded-xl border border-white/10 bg-white/[0.06] p-3 text-left">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-black text-white">{comment.name}</h4>
                    <p className="text-xs text-slate-400">{comment.phone} - {comment.board}</p>
                  </div>
                  <span className="text-[11px] text-slate-500">{comment.created_at ? new Date(comment.created_at).toLocaleDateString() : ''}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-200">{comment.comment}</p>
              </article>
            ))
          ) : (
            <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300 text-center">No comments yet.</p>
          )}
        </div>
      ) : null}
    </Panel>
  );
}

export default function CommentCenter() {
  const [activePanel, setActivePanel] = useState('');
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const showAdminButton = pathname === '/';

  useEffect(() => {
    setMounted(true);
  }, []);

  const buttons = (
    <div className="no-print flex shrink-0 items-center gap-2">
      <motion.button
        type="button"
        onClick={() => setActivePanel('comment')}
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-br from-cyan-300 via-emerald-300 to-lime-300 px-3 text-xs font-black text-slate-950 shadow-[0_7px_0_rgba(2,6,23,0.72),0_15px_28px_rgba(16,185,129,0.22)] transition active:translate-y-1 sm:px-4 sm:text-sm cursor-pointer"
        animate={{ y: [0, -3, 0], scale: [1, 1.03, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <MessageSquare size={17} />
        <span className="hidden sm:inline">Comment</span>
      </motion.button>
      {showAdminButton ? (
        <button
          type="button"
          onClick={() => setActivePanel('admin')}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-br from-amber-300 via-orange-300 to-rose-400 px-3 text-xs font-black text-slate-950 shadow-[0_7px_0_rgba(2,6,23,0.72),0_15px_28px_rgba(251,146,60,0.22)] transition hover:-translate-y-0.5 active:translate-y-1 sm:px-4 sm:text-sm cursor-pointer"
        >
          <ShieldCheck size={17} />
          <span className="hidden sm:inline">Display</span>
        </button>
      ) : null}
    </div>
  );

  if (!mounted) {
    return buttons;
  }

  return (
    <>
      {buttons}
      {createPortal(
        <AnimatePresence>
          {activePanel === 'comment' ? <CommentForm onClose={() => setActivePanel('')} /> : null}
          {activePanel === 'admin' ? <AdminPanel onClose={() => setActivePanel('')} /> : null}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
