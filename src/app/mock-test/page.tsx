'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import supabase from '@/lib/supabase/client';
import AppShell from '@/components/AppShell';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import { Sparkles, Timer, CheckCircle, ChevronLeft, ChevronRight, Award, Trophy, ShieldAlert, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { boards, getClasses, getSubjects } from '@/data/catalog';

interface MockQuestion {
  id: string;
  type: string;
  difficulty: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

function MockTestEngineInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Read syllabus parameters from URL
  const queryBoard = searchParams.get('board') || '';
  const queryClass = searchParams.get('class') || '';
  const querySubject = searchParams.get('subject') || '';

  const { 
    user, 
    studentProfile, 
    loading: authLoading, 
    loginWithEmail, 
    signupWithEmail, 
    updateStudentProfile 
  } = useAuthStore();

  const [testStarted, setTestStarted] = useState(false);
  const [questions, setQuestions] = useState<MockQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Inline auth state
  const [isSignUp, setIsSignUp] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authBoard, setAuthBoard] = useState(queryBoard);
  const [authClass, setAuthClass] = useState(queryClass);
  const [authSubject, setAuthSubject] = useState(querySubject);
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Test state
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [duration, setDuration] = useState(600); // 10 minutes (600s)
  const [testFinished, setTestFinished] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [savingTest, setSavingTest] = useState(false);
  const [certificateId, setCertificateId] = useState<string | null>(null);

  // Sync state variables if URL query params change
  useEffect(() => {
    if (queryBoard) setAuthBoard(queryBoard);
    if (queryClass) setAuthClass(queryClass);
    if (querySubject) setAuthSubject(querySubject);
  }, [queryBoard, queryClass, querySubject]);

  // Handle dynamic selects when auth selection is needed
  const classesList = useMemo(() => {
    if (!authBoard) return [];
    return getClasses(authBoard.toLowerCase());
  }, [authBoard]);

  const subjectsList = useMemo(() => {
    if (!authBoard || !authClass) return [];
    return getSubjects(authBoard.toLowerCase(), authClass);
  }, [authBoard, authClass]);

  // Timer countdown
  useEffect(() => {
    if (!testStarted || testFinished || duration <= 0) {
      if (duration === 0 && !testFinished) {
        handleFinishTest();
      }
      return;
    }

    const timer = setInterval(() => {
      setDuration((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [testStarted, testFinished, duration]);

  // Handle inline Auth Submission
  const handleInlineAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);

    try {
      const activeBoard = authBoard || queryBoard;
      const activeClass = authClass || queryClass;
      const activeSubject = authSubject || querySubject;

      if (!activeBoard || !activeClass || !activeSubject) {
        throw new Error('Please select your Board, Class and Subject.');
      }

      let loggedUser = null;
      if (isSignUp) {
        if (!authName) throw new Error('Full Name is required.');
        if (!/^\d{10}$/.test(authPhone)) throw new Error('Enter a valid 10 digit phone number.');
        
        loggedUser = await signupWithEmail(authEmail, authPassword, authName);
        if (loggedUser) {
          // Sync profile details to Supabase
          await updateStudentProfile({
            id: loggedUser.uid,
            email: authEmail,
            name: authName,
            phone: authPhone,
            board: activeBoard,
            class_name: activeClass,
            subject: activeSubject,
          });
          
          // Automatically launch the test immediately!
          await loadTestQuestions();
        }
      } else {
        loggedUser = await loginWithEmail(authEmail, authPassword);
        if (loggedUser) {
          // Update profile if missing board/class/subject
          const { data: currentProf } = await supabase
            .from('students')
            .select('*')
            .eq('id', loggedUser.uid)
            .maybeSingle();
          
          if (!currentProf || !currentProf.board) {
            await updateStudentProfile({
              id: loggedUser.uid,
              email: authEmail,
              name: currentProf?.name || loggedUser.displayName || 'Student',
              phone: currentProf?.phone || authPhone || '',
              board: activeBoard,
              class_name: activeClass,
              subject: activeSubject,
            });
          }
          
          // Automatically launch the test immediately!
          await loadTestQuestions();
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Load questions for mock test
  const loadTestQuestions = async () => {
    const activeBoard = studentProfile?.board || authBoard || queryBoard;
    const activeClass = studentProfile?.class_name || authClass || queryClass;
    const activeSubject = studentProfile?.subject || authSubject || querySubject;

    if (!activeBoard || !activeClass || !activeSubject) {
      setErrorMsg('Curriculum parameters are not resolved. Please select a board, class and subject.');
      return;
    }

    setLoadingQuestions(true);
    setErrorMsg('');

    try {
      let { data, error } = await supabase
        .from('question_bank')
        .select('*')
        .eq('board', activeBoard)
        .eq('class_name', activeClass)
        .eq('subject', activeSubject);

      if (error) throw error;

      let testQuestions = data || [];

      // If cache miss or insufficient questions, automatically trigger AI question generator!
      if (testQuestions.length < 10) {
        setLoadingQuestions(true);
        setErrorMsg('AI is generating dynamic mock test questions for your syllabus on the fly. Please wait up to 10 seconds...');
        
        const genResponse = await fetch('/api/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            board: activeBoard,
            className: activeClass,
            subject: activeSubject,
            chapter: 'General Syllabus Comprehensive Review'
          })
        });

        if (!genResponse.ok) {
          throw new Error('Failed to generate mock test questions automatically. Please try again.');
        }

        const genResult = await genResponse.json();
        if (genResult.questions && genResult.questions.length >= 10) {
          testQuestions = genResult.questions;
          setErrorMsg('');
        } else {
          throw new Error('Failed to retrieve sufficient mock test questions from the AI engine.');
        }
      }

      // Shuffle and pick 10 questions
      const shuffled = [...testQuestions].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 10).map((q: any) => ({
        id: q.id,
        type: q.type,
        difficulty: q.difficulty,
        question: q.question,
        options: q.options || [],
        answer: q.answer,
        explanation: q.explanation || '',
      }));

      setQuestions(selected);
      setTestStarted(true);
      setDuration(600); // Reset timer
      setCurrentIdx(0);
      setAnswers({});
      setTestFinished(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load test questions.');
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleSelectAnswer = (ans: string) => {
    setAnswers((prev) => ({ ...prev, [currentIdx]: ans }));
  };

  const handleFinishTest = async () => {
    setTestFinished(true);

    // Calculate score
    let score = 0;
    questions.forEach((q, idx) => {
      const studentAns = answers[idx] || '';
      const correctAns = q.answer;

      if (q.type === 'MCQ' || q.type === 'True/False' || q.type === 'Assertion Reason') {
        if (studentAns.trim().toLowerCase() === correctAns.trim().toLowerCase()) {
          score += 1;
        }
      } else {
        if (studentAns.length > 2) {
          score += 1;
        }
      }
    });

    setFinalScore(score);
    await saveTestResults(score);
  };

  const saveTestResults = async (score: number) => {
    const activeProfile = studentProfile || {
      board: authBoard || queryBoard,
      class_name: authClass || queryClass,
      subject: authSubject || querySubject,
    };

    if (!user || !activeProfile.board) return;
    setSavingTest(true);

    try {
      const percentage = (score / 10) * 100;
      const durationTaken = 600 - duration;

      // 1. Save Test Attempt in Supabase
      const { data: testData, error: testError } = await supabase
        .from('mock_tests')
        .insert({
          student_id: user.uid,
          board: activeProfile.board,
          class_name: activeProfile.class_name,
          subject: activeProfile.subject,
          score: score,
          total_questions: 10,
          duration_seconds: durationTaken,
        })
        .select('*')
        .single();

      if (testError) throw testError;

      // 2. Save Answers
      const answersToInsert = questions.map((q, idx) => ({
        test_id: testData.id,
        question_id: q.id,
        student_answer: answers[idx] || '',
        is_correct: (q.type === 'MCQ' || q.type === 'True/False') 
          ? (answers[idx] || '').trim().toLowerCase() === q.answer.trim().toLowerCase()
          : (answers[idx] || '').length > 2,
      }));

      await supabase.from('mock_questions').insert(answersToInsert);

      // 3. Generate Certificate if Score >= 80% (8 out of 10)
      if (score >= 8) {
        const certUniqueId = `QB-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        
        const { data: certData, error: certError } = await supabase
          .from('certificates')
          .insert({
            student_id: user.uid,
            test_id: testData.id,
            board: activeProfile.board,
            class_name: activeProfile.class_name,
            subject: activeProfile.subject,
            score: score,
            percentage: percentage,
            certificate_id: certUniqueId,
          })
          .select('*')
          .single();

        if (certError) throw certError;
        setCertificateId(certData.id);
      }
    } catch (err: any) {
      console.error('Failed to save test details:', err);
    } finally {
      setSavingTest(false);
    }
  };

  const formattedTime = useMemo(() => {
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [duration]);

  if (authLoading) return <LoadingState label="Validating test credentials..." />;

  // Display params summary
  const activeBoard = studentProfile?.board || authBoard || queryBoard;
  const activeClass = studentProfile?.class_name || authClass || queryClass;
  const activeSubject = studentProfile?.subject || authSubject || querySubject;
  const isProfileComplete = activeBoard && activeClass && activeSubject;

  return (
    <AppShell>
      <div className="flex h-full flex-col overflow-hidden text-left bg-[#050816]/30 text-white">
        {!testStarted ? (
          /* Landing / Auth / Config screen */
          <div className="flex-1 w-full min-h-0 thin-scrollbar overflow-y-auto px-4 py-10 sm:py-16 flex flex-col items-center justify-start text-center space-y-6">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl sm:rounded-3xl bg-gradient-to-br from-emerald-300 via-teal-300 to-cyan-400 p-[2px] shadow-[0_10px_24px_rgba(52,211,153,0.22)]"
          >
            <div className="h-full w-full rounded-[13px] sm:rounded-[22px] bg-[#050816] grid place-items-center text-emerald-300">
              <Trophy size={20} className="sm:size-[28px]" />
            </div>
          </motion.div>

          <div className="max-w-md">
            <h2 className="text-xl sm:text-3xl font-black tracking-tight text-white leading-tight">
              MOCK TEST ENGINE
            </h2>
            <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
              Take a rapid 10-question evaluation aligned to your curriculum parameters. Score 80% or higher to earn an AI-validated certificate.
            </p>
          </div>

          {!user ? (
            /* Cinematic Auth Box inline */
            <div className="glass max-w-md w-full p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/12 text-left space-y-3 sm:space-y-4">
              <div className="text-center pb-2">
                <span className="text-[10px] font-black uppercase text-cyan-200 tracking-widest">Onboarding Authentication</span>
                <h4 className="text-sm sm:text-lg font-black mt-1 text-white">
                  {isSignUp ? 'Sign up to begin mock test' : 'Sign in to your account'}
                </h4>
              </div>

              <form onSubmit={handleInlineAuth} className="space-y-3.5">
                {isSignUp && (
                  <>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">Full Name</label>
                      <input
                        type="text"
                        required
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 text-white outline-none focus:border-cyan-200/60 text-xs"
                        placeholder="e.g. Susanto Ganguly"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">Phone Number (10 digits)</label>
                      <input
                        type="text"
                        required
                        pattern="\d{10}"
                        value={authPhone}
                        onChange={(e) => setAuthPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 text-white outline-none focus:border-cyan-200/60 text-xs"
                        placeholder="e.g. 9835379900"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">Email Address</label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 text-white outline-none focus:border-cyan-200/60 text-xs"
                    placeholder="you@school.com"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">Password</label>
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 text-white outline-none focus:border-cyan-200/60 text-xs"
                    placeholder="••••••••"
                  />
                </div>

                {/* Pre-fill Curriculum Fields if query params exist, otherwise show select fields */}
                <div className="pt-2 border-t border-white/5 space-y-2">
                  <span className="block text-[10px] font-black uppercase text-cyan-200 tracking-wider">Syllabus Parameters</span>
                  {queryBoard && queryClass && querySubject ? (
                    <div className="p-3 rounded-xl border border-emerald-300/10 bg-emerald-300/5 text-[11px] space-y-1">
                      <p><span className="text-slate-400">Board:</span> <span className="font-bold text-slate-200">{queryBoard}</span></p>
                      <p><span className="text-slate-400">Class:</span> <span className="font-bold text-slate-200">{queryClass}</span></p>
                      <p><span className="text-slate-400">Subject:</span> <span className="font-bold text-slate-200">{querySubject}</span></p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <select
                        required
                        value={authBoard}
                        onChange={(e) => {
                          setAuthBoard(e.target.value);
                          setAuthClass('');
                          setAuthSubject('');
                        }}
                        className="h-10 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-white outline-none focus:border-cyan-200/60 text-xs"
                      >
                        <option value="">Select Board</option>
                        {boards.map((b) => (
                          <option key={b.id} value={b.name}>{b.name}</option>
                        ))}
                      </select>

                      <select
                        required
                        disabled={!authBoard}
                        value={authClass}
                        onChange={(e) => {
                          setAuthClass(e.target.value);
                          setAuthSubject('');
                        }}
                        className="h-10 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-white outline-none focus:border-cyan-200/60 text-xs disabled:opacity-50"
                      >
                        <option value="">Select Class</option>
                        {classesList.map((cls) => (
                          <option key={cls} value={cls}>{cls}</option>
                        ))}
                      </select>

                      <select
                        required
                        disabled={!authClass}
                        value={authSubject}
                        onChange={(e) => setAuthSubject(e.target.value)}
                        className="h-10 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-white outline-none focus:border-cyan-200/60 text-xs disabled:opacity-50"
                      >
                        <option value="">Select Subject</option>
                        {subjectsList.map((sub) => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {authError && (
                  <div className="flex items-start gap-1.5 p-3 rounded-xl border border-rose-300/20 bg-rose-300/10 text-rose-300 text-[11px] leading-normal">
                    <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-emerald-300 via-teal-300 to-cyan-400 text-slate-950 font-black shadow-lg cursor-pointer text-xs"
                >
                  <LogIn size={15} />
                  {authSubmitting ? 'Authenticating...' : isSignUp ? 'Register & Start Mock Test' : 'Sign In & Start Mock Test'}
                </button>
              </form>

              <div className="text-center pt-2 border-t border-white/5">
                <button
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-[10px] text-slate-400 hover:text-cyan-200 tracking-wider font-semibold cursor-pointer uppercase"
                >
                  {isSignUp ? 'Already have an account? Sign In' : 'New student? Create an account'}
                </button>
              </div>
            </div>
          ) : (
            /* Logged in parameters check & launch */
            <div className="space-y-4 max-w-sm w-full">
              {isProfileComplete ? (
                <>
                  <div className="glass p-5 rounded-2xl border border-white/10 text-xs text-left space-y-2">
                    <p className="font-bold text-cyan-200 tracking-wider uppercase">Active Syllabus Parameters</p>
                    <p><span className="text-slate-400">Board:</span> <span className="font-bold text-slate-200">{activeBoard}</span></p>
                    <p><span className="text-slate-400">Class:</span> <span className="font-bold text-slate-200">{activeClass}</span></p>
                    <p><span className="text-slate-400">Subject:</span> <span className="font-bold text-slate-200">{activeSubject}</span></p>
                  </div>

                  {errorMsg && (
                    <div className="p-4 rounded-xl border border-rose-300/20 bg-rose-300/10 text-rose-300 text-xs leading-normal">
                      {errorMsg}
                    </div>
                  )}

                  <button
                    onClick={loadTestQuestions}
                    disabled={loadingQuestions}
                    className="inline-flex h-12 w-full px-8 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-emerald-300 via-teal-300 to-cyan-400 text-slate-950 font-black shadow-[0_8px_0_rgba(2,6,23,0.7)] transition active:translate-y-1 disabled:opacity-50 cursor-pointer"
                  >
                    {loadingQuestions ? 'Preparing Engine...' : 'Launch Test Now'}
                  </button>
                </>
              ) : (
                /* Profile exists but has missing parameters */
                <div className="glass p-5 rounded-2xl border border-white/10 text-left space-y-3">
                  <div className="text-center">
                    <p className="font-bold text-cyan-200 uppercase tracking-widest text-[10px]">Setup Curriculum</p>
                    <p className="text-xs text-slate-300 mt-1">Configure your mock test board, class, and subject below.</p>
                  </div>

                  <div className="space-y-2">
                    <select
                      required
                      value={authBoard}
                      onChange={(e) => {
                        setAuthBoard(e.target.value);
                        setAuthClass('');
                        setAuthSubject('');
                      }}
                      className="h-11 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-white outline-none focus:border-cyan-200/60 text-xs"
                    >
                      <option value="">Select Board</option>
                      {boards.map((b) => (
                        <option key={b.id} value={b.name}>{b.name}</option>
                      ))}
                    </select>

                    <select
                      required
                      disabled={!authBoard}
                      value={authClass}
                      onChange={(e) => {
                        setAuthClass(e.target.value);
                        setAuthSubject('');
                      }}
                      className="h-11 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-white outline-none focus:border-cyan-200/60 text-xs disabled:opacity-50"
                    >
                      <option value="">Select Class</option>
                      {classesList.map((cls) => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>

                    <select
                      required
                      disabled={!authClass}
                      value={authSubject}
                      onChange={(e) => setAuthSubject(e.target.value)}
                      className="h-11 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-white outline-none focus:border-cyan-200/60 text-xs disabled:opacity-50"
                    >
                      <option value="">Select Subject</option>
                      {subjectsList.map((sub) => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>

                    <button
                      onClick={async () => {
                        setErrorMsg('');
                        if (!authBoard || !authClass || !authSubject) {
                          setErrorMsg('Please select board, class and subject.');
                          return;
                        }
                        const success = await updateStudentProfile({
                          board: authBoard,
                          class_name: authClass,
                          subject: authSubject,
                        });
                        if (success) {
                          loadTestQuestions();
                        } else {
                          setErrorMsg('Failed to sync profile update.');
                        }
                      }}
                      className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-emerald-300 via-teal-300 to-cyan-400 text-slate-950 font-black shadow-lg cursor-pointer text-xs"
                    >
                      Save Parameters & Launch Test
                    </button>

                    {errorMsg && (
                      <p className="text-xs text-rose-300 text-center">{errorMsg}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : testFinished ? (
        /* Results screen */
        <div className="flex-1 min-h-0 thin-scrollbar overflow-y-auto p-6 sm:py-16 flex flex-col items-center justify-start text-center space-y-6">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 p-[3px] shadow-lg"
          >
            <div className="h-full w-full rounded-full bg-[#050816] grid place-items-center text-yellow-300">
              {finalScore >= 8 ? <Award size={36} className="animate-bounce" /> : <CheckCircle size={36} />}
            </div>
          </motion.div>

          <div>
            <h3 className="text-3xl font-black text-white leading-tight">
              {finalScore >= 8 ? 'CONGRATULATIONS!' : 'TEST COMPLETE'}
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              You scored <span className="text-cyan-200 font-bold">{finalScore} / 10</span> ({finalScore * 10}%)
            </p>
          </div>

          {finalScore >= 8 ? (
            <div className="glass max-w-md p-5 rounded-2xl border border-yellow-300/20 bg-yellow-300/5 text-slate-200 text-sm space-y-3">
              <p className="font-bold text-yellow-300">Award Certificate Earned!</p>
              <p className="text-xs text-slate-300 leading-relaxed">
                Your exceptional score qualifies you for an AI Question Bank Certificate of Competency in {activeSubject}.
              </p>
              {certificateId && (
                <button
                  onClick={() => router.push(`/certificate/${certificateId}`)}
                  className="inline-flex h-10 px-5 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-yellow-300 to-amber-500 text-slate-950 font-black shadow-md cursor-pointer text-xs"
                >
                  View & Download Certificate <ChevronRight size={14} />
                </button>
              )}
            </div>
          ) : (
            <div className="glass max-w-sm p-4 rounded-xl border border-white/10 text-xs text-slate-400">
              Score 80% (8 / 10) or higher to unlock downloadable achievement certificates. Try again anytime!
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setTestStarted(false)}
              className="inline-flex h-11 px-6 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 text-slate-200 font-bold hover:bg-white/10 cursor-pointer text-xs"
            >
              Back to Test Center
            </button>
            
            <button
              onClick={() => router.push('/dashboard')}
              className="inline-flex h-11 px-6 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-cyan-300 via-sky-300 to-violet-400 text-slate-950 font-black cursor-pointer text-xs"
            >
              View Dashboard
            </button>
          </div>
        </div>
      ) : (
        /* Active test view */
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b border-white/10 bg-slate-950/20 px-4 py-3 flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase text-cyan-200 tracking-wider">MOCK EVALUATION</span>
              <h3 className="text-base sm:text-lg font-black text-white truncate">{activeSubject}</h3>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-rose-300/20 bg-rose-300/10 px-3 py-1.5 text-rose-200 text-xs font-black">
              <Timer size={15} />
              <span>{formattedTime}</span>
            </div>
          </div>

          <div className="thin-scrollbar flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            <div className="glass p-5 rounded-2xl border border-white/12 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-cyan-200 uppercase tracking-widest">Question {currentIdx + 1} of 10</span>
                <span className="rounded-lg border border-slate-700 bg-slate-800/50 px-2 py-0.5 text-[10px] text-slate-300 font-bold">
                  {questions[currentIdx].type}
                </span>
              </div>

              <div className="text-base sm:text-lg leading-relaxed text-white font-semibold whitespace-pre-wrap">
                {questions[currentIdx].question}
              </div>

              {questions[currentIdx].options?.length ? (
                <div className="grid gap-2.5 pt-2">
                  {questions[currentIdx].options.map((option, oIdx) => {
                    const prefix = String.fromCharCode(65 + oIdx);
                    const isSelected = answers[currentIdx] === prefix;
                    
                    return (
                      <button
                        key={option}
                        onClick={() => handleSelectAnswer(prefix)}
                        className={`w-full text-left rounded-xl border p-3.5 text-xs sm:text-sm font-semibold transition cursor-pointer flex gap-3 ${
                          isSelected
                            ? 'border-cyan-300 bg-cyan-300/10 text-white font-bold'
                            : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                        }`}
                      >
                        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded bg-slate-800 border border-slate-700 text-[11px] ${isSelected ? 'bg-cyan-200 text-slate-950 border-cyan-200 font-bold' : ''}`}>
                          {prefix}
                        </span>
                        <span>{option}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="pt-2">
                  <textarea
                    rows={4}
                    value={answers[currentIdx] || ''}
                    onChange={(e) => handleSelectAnswer(e.target.value)}
                    placeholder="Write your answer..."
                    className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.05] p-3 text-white outline-none focus:border-cyan-200/60 text-xs sm:text-sm"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-white/10 bg-slate-950/20 px-4 py-3.5 flex items-center justify-between">
            <button
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx((prev) => prev - 1)}
              className="inline-flex h-10 px-4 items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 text-slate-200 text-xs font-bold disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft size={16} /> Prev
            </button>

            {currentIdx < 9 ? (
              <button
                onClick={() => setCurrentIdx((prev) => prev + 1)}
                className="inline-flex h-10 px-4 items-center justify-center gap-1 rounded-xl bg-gradient-to-br from-white/10 to-white/5 text-slate-100 text-xs font-bold hover:bg-white/10 cursor-pointer"
              >
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleFinishTest}
                className="inline-flex h-10 px-5 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-emerald-300 to-teal-400 text-slate-950 font-black shadow-md cursor-pointer text-xs"
              >
                <CheckCircle size={15} /> Finish Test
              </button>
            )}
          </div>
        </div>
      )}
      </div>
    </AppShell>
  );
}

export default function MockTestEngine() {
  return (
    <Suspense fallback={<LoadingState label="Initializing quiz context..." />}>
      <MockTestEngineInner />
    </Suspense>
  );
}
