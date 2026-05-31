'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import supabase from '@/lib/supabase/client';
import AppShell from '@/components/AppShell';
import LoadingState from '@/components/LoadingState';
import { Sparkles, Timer, CheckCircle, ChevronLeft, ChevronRight, Award, Trophy, ShieldAlert, LogIn, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { boards, getClasses, getSubjects, getChapters } from '@/data/catalog';

interface MockQuestion {
  id: string;
  type: string;
  difficulty: string;
  bloom_level: string;
  concept_tag: string;
  learning_outcome: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  marks: number;
  estimated_time: number;
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
  const [authChapter, setAuthChapter] = useState('');
  const [testMode, setTestMode] = useState('standard');
  
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Test state
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [duration, setDuration] = useState(1200); // Dynamic timer in seconds
  const [totalTimeLimit, setTotalTimeLimit] = useState(1200);
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

  // Handle dynamic selects when selection is needed
  const classesList = useMemo(() => {
    if (!authBoard) return [];
    return getClasses(authBoard.toLowerCase());
  }, [authBoard]);

  const subjectsList = useMemo(() => {
    if (!authBoard || !authClass) return [];
    return getSubjects(authBoard.toLowerCase(), authClass);
  }, [authBoard, authClass]);

  const chaptersList = useMemo(() => {
    if (!authSubject) return [];
    return getChapters(authSubject);
  }, [authSubject]);

  // Set first chapter as default when subject changes
  useEffect(() => {
    if (chaptersList.length > 0) {
      setAuthChapter(chaptersList[0]);
    } else {
      setAuthChapter('');
    }
  }, [chaptersList]);

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

  // Handle inline Auth Submission (sign in or register)
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
          
          // Post-test auth path: save results to database if test was already completed as guest
          if (testFinished) {
            await handlePostTestAuth(loggedUser.uid, authName);
          } else {
            // Automatically launch the test immediately!
            await loadTestQuestions();
          }
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
          
          const profileName = currentProf?.name || loggedUser.displayName || 'Student';
          
          if (!currentProf || !currentProf.board) {
            await updateStudentProfile({
              id: loggedUser.uid,
              email: authEmail,
              name: profileName,
              phone: currentProf?.phone || authPhone || '',
              board: activeBoard,
              class_name: activeClass,
              subject: activeSubject,
            });
          }
          
          // Post-test auth path: save results to database if test was already completed as guest
          if (testFinished) {
            await handlePostTestAuth(loggedUser.uid, profileName);
          } else {
            // Automatically launch the test immediately!
            await loadTestQuestions();
          }
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  /**
   * Balanced Randomization & Difficulty Sampler (30% Easy, 40% Medium, 30% Hard)
   */
  const sampleMockQuestions = (allQuestions: any[], mode: string): MockQuestion[] => {
    let easyCount = 6;
    let mediumCount = 8;
    let hardCount = 6;

    switch (mode) {
      case 'quick':
        easyCount = 2; mediumCount = 2; hardCount = 1; // 5 questions
        break;
      case 'mini':
        easyCount = 3; mediumCount = 4; hardCount = 3; // 10 questions
        break;
      case 'half':
        easyCount = 9; mediumCount = 12; hardCount = 9; // 30 questions
        break;
      case 'full':
        easyCount = 15; mediumCount = 20; hardCount = 15; // 50 questions
        break;
      case 'board':
        easyCount = 12; mediumCount = 16; hardCount = 12; // 40 questions
        break;
      case 'standard':
      default:
        easyCount = 6; mediumCount = 8; hardCount = 6; // 20 questions
        break;
    }

    // Shuffle pool first to prevent systematic concept selection
    const shuffledAll = [...allQuestions].sort(() => 0.5 - Math.random());

    const easyPool = shuffledAll.filter((q) => q.difficulty?.toLowerCase() === 'easy');
    const mediumPool = shuffledAll.filter((q) => q.difficulty?.toLowerCase() === 'medium');
    const hardPool = shuffledAll.filter((q) => q.difficulty?.toLowerCase() === 'hard');

    // Sampling helper prioritizing unique concept tags (Deduplication)
    const selectFromPool = (pool: any[], targetCount: number) => {
      const selected: any[] = [];
      const usedConcepts = new Set<string>();

      // Pass 1: Select unique concepts
      for (const q of pool) {
        if (selected.length >= targetCount) break;
        const concept = (q.concept_tag || '').trim().toLowerCase();
        if (!concept || !usedConcepts.has(concept)) {
          selected.push(q);
          if (concept) usedConcepts.add(concept);
        }
      }

      // Pass 2: Fill remaining slot values if unique concept counts were insufficient
      if (selected.length < targetCount) {
        for (const q of pool) {
          if (selected.length >= targetCount) break;
          if (!selected.includes(q)) {
            selected.push(q);
          }
        }
      }

      return selected;
    };

    const selectedEasy = selectFromPool(easyPool, easyCount);
    const selectedMedium = selectFromPool(mediumPool, mediumCount);
    const selectedHard = selectFromPool(hardPool, hardCount);

    // Combine and shuffle to avoid predictable difficulty order
    return [...selectedEasy, ...selectedMedium, ...selectedHard].sort(() => 0.5 - Math.random());
  };

  // Load questions for mock test
  const loadTestQuestions = async () => {
    const activeBoard = studentProfile?.board || authBoard || queryBoard;
    const activeClass = studentProfile?.class_name || authClass || queryClass;
    const activeSubject = studentProfile?.subject || authSubject || querySubject;
    const activeChapter = authChapter || chaptersList[0] || 'Core Concepts';

    if (!activeBoard || !activeClass || !activeSubject) {
      setErrorMsg('Curriculum parameters are not resolved. Please select a board, class and subject.');
      return;
    }

    setLoadingQuestions(true);
    setErrorMsg('');

    try {
      let genResponse = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board: activeBoard,
          className: activeClass,
          subject: activeSubject,
          chapter: activeChapter
        })
      });

      if (!genResponse.ok) {
        const errData = await genResponse.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to retrieve mock test questions.');
      }

      const genResult = await genResponse.json();
      const allQuestions = genResult.questions || [];

      if (allQuestions.length < 20) {
        throw new Error('Insufficient questions stored in the database for this chapter. Please retry.');
      }

      // Enforce 30-40-30 balanced sampling based on Mode size
      const sampled = sampleMockQuestions(allQuestions, testMode);

      setQuestions(sampled);
      setTestStarted(true);

      // Set dynamic time limits
      let timeLimit = 1200; // standard 20 mins
      switch (testMode) {
        case 'quick': timeLimit = 300; break;     // 5 mins
        case 'mini': timeLimit = 600; break;      // 10 mins
        case 'half': timeLimit = 1800; break;     // 30 mins
        case 'full': timeLimit = 3600; break;     // 60 mins
        case 'board': timeLimit = 2400; break;    // 40 mins
      }

      setTotalTimeLimit(timeLimit);
      setDuration(timeLimit);
      setCurrentIdx(0);
      setAnswers({});
      setTestFinished(false);
      setCertificateId(null);
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

    // Smart multi-paradigm grading comparisons for MCQ options, letter indices, and text values
    let score = 0;
    questions.forEach((q, idx) => {
      const studentAns = (answers[idx] || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const correctAns = (q.answer || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

      if (q.type === 'MCQ' || q.type === 'True/False' || q.type === 'Assertion Reason') {
        // 1. Direct match
        if (studentAns === correctAns) {
          score += 1;
          return;
        }

        // 2. Letter-to-Text match
        if (q.options && q.options.length > 0) {
          const correctOptionIdx = q.options.findIndex(
            (opt: string) => opt.trim().toLowerCase().replace(/[^a-z0-9]/g, '') === correctAns
          );

          if (correctOptionIdx !== -1) {
            const correctLetter = String.fromCharCode(97 + correctOptionIdx); // 'a', 'b', 'c', 'd'
            if (studentAns === correctLetter) {
              score += 1;
              return;
            }
          }

          // 3. Text-to-Letter match
          const selectedOptionIdx = studentAns.charCodeAt(0) - 97; // e.g., 'a' -> 0
          if (
            selectedOptionIdx >= 0 && 
            selectedOptionIdx < q.options.length && 
            q.options[selectedOptionIdx].trim().toLowerCase().replace(/[^a-z0-9]/g, '') === correctAns
          ) {
            score += 1;
            return;
          }
        }
      } else if (q.type === 'Fill in the Blanks' || q.type === 'One Word' || q.type === 'Full Forms') {
        // Direct string match with robust case/punctuation stripping
        if (studentAns === correctAns) {
          score += 1;
        }
      } else {
        // Very Short, Short, Medium, Long descriptive answers need simple token validation
        if (studentAns.length > 3) {
          score += 1;
        }
      }
    });

    setFinalScore(score);

    // Save test results immediately if the user is already authenticated
    if (user) {
      await saveTestResults(score);
    }
  };

  // Save results for authenticated user via server-side API
  const saveTestResults = async (score: number, overrideUid?: string) => {
    const activeProfile = studentProfile || {
      board: authBoard || queryBoard,
      class_name: authClass || queryClass,
      subject: authSubject || querySubject,
    };

    const targetUid = overrideUid || user?.uid;
    if (!targetUid || !activeProfile.board) return;
    
    setSavingTest(true);

    try {
      const durationTaken = totalTimeLimit - duration;

      const response = await fetch('/api/mock-test/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: targetUid,
          board: activeProfile.board,
          className: activeProfile.class_name,
          subject: activeProfile.subject,
          score: score,
          durationSeconds: durationTaken,
          questions: questions,
          answers: answers,
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save test results.');
      }

      const result = await response.json();
      if (result.certificateId) {
        setCertificateId(result.certificateId);
      }
    } catch (err: any) {
      console.error('Failed to save test details:', err);
    } finally {
      setSavingTest(false);
    }
  };

  // Post-test auth pipeline for guest users: save results to database after auth completes
  const handlePostTestAuth = async (uid: string, profileName: string) => {
    await saveTestResults(finalScore, uid);
  };

  const formattedTime = useMemo(() => {
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [duration]);

  if (authLoading) return <LoadingState label="Validating test parameters..." />;

  // Display params summary
  const activeBoard = studentProfile?.board || authBoard || queryBoard;
  const activeClass = studentProfile?.class_name || authClass || queryClass;
  const activeSubject = studentProfile?.subject || authSubject || querySubject;
  const activeChapter = authChapter || chaptersList[0];
  const isProfileComplete = activeBoard && activeClass && activeSubject && activeChapter;

  // Passing criteria (80% score threshold)
  const passingScore = Math.ceil(questions.length * 0.8);
  const isPassed = finalScore >= passingScore;
  const percentage = questions.length > 0 ? Math.round((finalScore / questions.length) * 100) : 0;

  return (
    <AppShell>
      <div className="relative h-full w-full text-left bg-[#050816]/30 text-white">
        {!testStarted ? (
          /* Onboarding Landing Form */
          <div className="absolute inset-0 overflow-y-auto thin-scrollbar px-4 py-8 sm:py-12 flex flex-col items-center justify-start text-center space-y-6 pb-24">
            
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-64 w-64 bg-emerald-500/10 rounded-full blur-[110px] pointer-events-none"></div>

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl sm:rounded-3xl bg-gradient-to-br from-emerald-300 via-teal-300 to-cyan-400 p-[2px] shadow-[0_10px_24px_rgba(52,211,153,0.22)] shrink-0"
            >
              <div className="h-full w-full rounded-[13px] sm:rounded-[22px] bg-[#050816] grid place-items-center text-emerald-300">
                <Trophy size={20} className="sm:size-[28px]" />
              </div>
            </motion.div>

            <div className="max-w-md space-y-2 shrink-0">
              <h2 className="text-xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                MOCK EVALUATION ENGINE
              </h2>
              <p className="text-xs text-emerald-300 font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full w-fit mx-auto">
                ⚡ PRECISE DIFFICULTY • NO DUPES
              </p>
              <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                Test your skills with randomized, non-repetitive board questions. Score 80% or higher to unlock a certified landscape credential!
              </p>
            </div>

            <div className="glass max-w-md w-full p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/12 text-left space-y-4 shadow-2xl relative overflow-hidden bg-slate-900/80 shrink-0">
              <div className="absolute -top-12 -left-12 h-32 w-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none"></div>
              <div className="absolute -bottom-12 -right-12 h-32 w-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

              <div className="text-left pb-2 border-b border-white/5">
                <span className="text-[9px] font-black uppercase text-cyan-200 tracking-widest">Syllabus configuration</span>
                <h4 className="text-sm sm:text-base font-black mt-0.5 text-white">Configure Mock Parameters</h4>
              </div>

              <div className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Curriculum Board</label>
                    <select
                      required
                      value={authBoard}
                      onChange={(e) => {
                        setAuthBoard(e.target.value);
                        setAuthClass('');
                        setAuthSubject('');
                        setAuthChapter('');
                      }}
                      className="h-10 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-white outline-none focus:border-cyan-200/60 text-xs"
                    >
                      <option value="">Choose Board</option>
                      {boards.map((b) => (
                        <option key={b.id} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Grade / Class</label>
                    <select
                      required
                      disabled={!authBoard}
                      value={authClass}
                      onChange={(e) => {
                        setAuthClass(e.target.value);
                        setAuthSubject('');
                        setAuthChapter('');
                      }}
                      className="h-10 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-white outline-none focus:border-cyan-200/60 text-xs disabled:opacity-40"
                    >
                      <option value="">Choose Class</option>
                      {classesList.map((cls) => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Curriculum Subject</label>
                    <select
                      required
                      disabled={!authClass}
                      value={authSubject}
                      onChange={(e) => {
                        setAuthSubject(e.target.value);
                        setAuthChapter('');
                      }}
                      className="h-10 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-white outline-none focus:border-cyan-200/60 text-xs disabled:opacity-40"
                    >
                      <option value="">Choose Subject</option>
                      {subjectsList.map((sub) => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>

                  {authSubject && (
                    <div>
                      <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Chapter Selection</label>
                      <select
                        required
                        value={authChapter}
                        onChange={(e) => setAuthChapter(e.target.value)}
                        className="h-10 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-white outline-none focus:border-cyan-200/60 text-xs"
                      >
                        <option value="">Choose Chapter</option>
                        {chaptersList.map((ch) => (
                          <option key={ch} value={ch}>{ch}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Test Mode & Dynamic Size</label>
                    <select
                      required
                      value={testMode}
                      onChange={(e) => setTestMode(e.target.value)}
                      className="h-10 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-white outline-none focus:border-cyan-200/60 text-xs"
                    >
                      <option value="quick">Quick Test (5 Questions - 5 mins)</option>
                      <option value="mini">Mini Test (10 Questions - 10 mins)</option>
                      <option value="standard">Standard Test (20 Questions - 20 mins - Recommended)</option>
                      <option value="half">Half-Length Exam (30 Questions - 30 mins)</option>
                      <option value="full">Full-Length Exam (50 Questions - 60 mins)</option>
                      <option value="board">Complete Board Mock Test (40 Questions - 40 mins)</option>
                    </select>
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-3.5 rounded-xl border border-rose-300/20 bg-rose-300/10 text-rose-300 text-xs text-center">
                    {errorMsg}
                  </div>
                )}

                <button
                  onClick={async () => {
                    if (!authBoard || !authClass || !authSubject || !authChapter) {
                      setErrorMsg('Please configure all syllabus parameters, including chapter.');
                      return;
                    }
                    
                    if (user) {
                      await updateStudentProfile({
                        board: authBoard,
                        class_name: authClass,
                        subject: authSubject,
                      });
                    }
                    await loadTestQuestions();
                  }}
                  disabled={loadingQuestions}
                  className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-emerald-300 via-teal-300 to-cyan-400 text-slate-950 font-black shadow-[0_4px_0_#047857] active:translate-y-0.5 transition duration-150 cursor-pointer text-xs uppercase tracking-wider"
                >
                  {loadingQuestions ? 'Populating & Querying Database...' : 'Launch Assessment'}
                </button>
              </div>
            </div>
          </div>
        ) : testFinished ? (
          /* Results Summary Page */
          <div className="absolute inset-0 overflow-y-auto thin-scrollbar px-4 py-8 sm:py-12 flex flex-col items-center justify-start text-center space-y-6 pb-24">
            
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-64 w-64 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none"></div>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-orange-500 p-[2.5px] shadow-lg shrink-0"
            >
              <div className="h-full w-full rounded-full bg-[#050816] grid place-items-center text-amber-300">
                {isPassed ? <Award size={30} className="animate-bounce" /> : <CheckCircle size={30} />}
              </div>
            </motion.div>

            <div className="shrink-0">
              <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                {isPassed ? 'EVALUATION COMPLETE!' : 'TEST COMPLETED'}
              </h3>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-400">
                Subject Score: <span className="text-amber-300 font-extrabold text-base">{finalScore} / {questions.length}</span> ({percentage}%)
              </p>
            </div>

            {/* Guest credential claim block */}
            {!user ? (
              <div className="w-full max-w-lg space-y-6 shrink-0">
                
                {/* Gold-Bordered Watermarked Certificate Preview */}
                <div className="relative overflow-hidden p-6 rounded-2xl border-[3px] border-double border-yellow-500/40 bg-slate-950/80 shadow-2xl space-y-4 text-left select-none shrink-0">
                  <div className="absolute inset-0 flex items-center justify-center rotate-[-15deg] pointer-events-none select-none overflow-hidden opacity-10">
                    <span className="text-3xl sm:text-4xl font-black uppercase text-red-500 tracking-wider whitespace-nowrap border-4 border-double border-red-500 p-2 sm:p-4 text-center">
                      PROVISIONAL GUEST • REQ AUTH
                    </span>
                  </div>
                  
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-20deg] bg-rose-500/90 text-slate-950 text-[10px] sm:text-xs font-black uppercase py-2 px-8 tracking-widest text-center shadow-lg border-y-2 border-white/20 z-10 w-[140%] select-none flex items-center justify-center gap-1.5">
                    <Lock size={12} />
                    <span>Login to unlock certified PDF</span>
                  </div>

                  <div className="opacity-40 space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="space-y-0.5">
                        <span className="text-[7px] font-black uppercase text-yellow-500 tracking-wider">Verification Certificate</span>
                        <h4 className="text-xs sm:text-sm font-black text-white">QUESTION BANK AI CREDENTIAL</h4>
                      </div>
                      <Trophy size={20} className="text-yellow-500" />
                    </div>

                    <div className="space-y-1 border-t border-white/5 pt-2">
                      <p className="text-[9px] text-slate-400">Awarded to Student:</p>
                      <p className="text-sm font-black text-white tracking-wide">
                        {authName || 'Your Name Will Be Displayed'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div>
                        <p className="text-[8px] text-slate-400">Curriculum Syllabus</p>
                        <p className="text-[10px] font-extrabold text-slate-200">{activeSubject} ({activeBoard})</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-slate-400">Credential Rating</p>
                        <p className="text-[10px] font-extrabold text-slate-200">Score {finalScore}/{questions.length} ({percentage}%)</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Account setup callout */}
                <div className="glass p-6 sm:p-8 rounded-2xl sm:rounded-3xl border border-cyan-300/20 bg-slate-900/90 text-left space-y-4 shadow-2xl relative overflow-hidden shrink-0">
                  <div className="absolute -top-12 -right-12 h-32 w-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none"></div>

                  <div className="text-center pb-2 border-b border-white/5">
                    <span className="text-[10px] font-black uppercase text-amber-200 tracking-widest">Register Achievement</span>
                    <h4 className="text-sm sm:text-base font-black mt-1 text-white">
                      {isSignUp ? 'Sign up to claim your certificate' : 'Sign in to sync your score'}
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Create a profile to save this score, remove the watermark, and download your official gold-bordered credential PDF!
                    </p>
                  </div>

                  <form onSubmit={handleInlineAuth} className="space-y-3.5" autoComplete="off">
                    {isSignUp && (
                      <>
                        <div>
                          <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Full Name (Displayed on Certificate)</label>
                          <input
                            type="text"
                            required
                            value={authName}
                            onChange={(e) => setAuthName(e.target.value)}
                            className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-white outline-none focus:border-cyan-200/60 text-xs"
                            placeholder="Enter your full name"
                            autoComplete="off"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">10-Digit Mobile Number</label>
                          <input
                            type="text"
                            required
                            pattern="\d{10}"
                            value={authPhone}
                            onChange={(e) => setAuthPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-white outline-none focus:border-cyan-200/60 text-xs"
                            placeholder="Enter 10-digit mobile number"
                            autoComplete="off"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Email Address</label>
                      <input
                        type="email"
                        required
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-white outline-none focus:border-cyan-200/60 text-xs"
                        placeholder="you@domain.com"
                        autoComplete="off"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Password</label>
                      <input
                        type="password"
                        required
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-white outline-none focus:border-cyan-200/60 text-xs"
                        placeholder="••••••••"
                        autoComplete="new-password"
                      />
                    </div>

                    {authError && (
                      <div className="flex items-start gap-1.5 p-3 rounded-xl border border-rose-300/20 bg-rose-300/10 text-rose-300 text-[10px] leading-normal">
                        <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                        <span>{authError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={authSubmitting || savingTest}
                      className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-emerald-300 via-teal-300 to-cyan-400 text-slate-950 font-black shadow-[0_4px_0_#047857] active:translate-y-0.5 transition duration-150 cursor-pointer text-xs uppercase tracking-wider"
                    >
                      <LogIn size={15} />
                      {authSubmitting ? 'Syncing...' : isSignUp ? 'Claim Verified Certificate' : 'Sign In & Claim Certificate'}
                    </button>
                  </form>

                  <div className="text-center pt-2 border-t border-white/5">
                    <button
                      onClick={() => setIsSignUp(!isSignUp)}
                      className="text-[9px] text-slate-400 hover:text-cyan-200 tracking-wider font-semibold cursor-pointer uppercase"
                    >
                      {isSignUp ? 'Already have an account? Sign In' : 'New student? Register profile'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Authenticated results view */
              <div className="w-full max-w-md space-y-4 shrink-0">
                {isPassed ? (
                  <div className="glass p-6 rounded-2xl border border-yellow-300/20 bg-slate-900/60 text-slate-200 text-xs text-left space-y-3 shadow-2xl relative overflow-hidden shrink-0">
                    <div className="absolute -top-12 -left-12 h-32 w-32 bg-yellow-500/10 rounded-full blur-2xl pointer-events-none"></div>
                    
                    <p className="font-extrabold text-yellow-300 uppercase tracking-widest text-[10px] flex items-center gap-1">
                      <Award size={14} /> Official Credential Unlocked!
                    </p>
                    <p className="text-slate-300 leading-relaxed text-[11px]">
                      Congratulations, <span className="font-bold text-white">{studentProfile?.name || user.displayName || 'Student'}</span>! Your high score has successfully generated an official verified certificate of competency.
                    </p>
                    
                    {savingTest ? (
                      <div className="text-center text-xs text-slate-400 font-bold py-2">
                        Registering credential with database...
                      </div>
                    ) : certificateId ? (
                      <button
                        onClick={() => router.push(`/certificate/${certificateId}`)}
                        className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-500 text-slate-950 font-black shadow-[0_4px_0_#9a3412] active:translate-y-0.5 transition duration-150 cursor-pointer text-xs uppercase tracking-wider"
                      >
                        Download Official Certificate <ChevronRight size={14} />
                      </button>
                    ) : (
                      <div className="text-slate-400 text-center py-2 text-[10px]">
                        Synchronizing credential id... Click Dashboard to review historical certificates.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="glass p-5 rounded-2xl border border-white/10 text-xs text-slate-400 bg-slate-900/40 shrink-0">
                    You scored {finalScore}/{questions.length} ({percentage}%). Try again anytime to score 80% or higher to claim a certified achievement credential.
                  </div>
                )}

                <div className="flex gap-3 pt-2 w-full shrink-0">
                  <button
                    onClick={() => {
                      setTestStarted(false);
                      setCertificateId(null);
                    }}
                    className="flex-1 inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/40 text-slate-200 font-black hover:bg-white/5 cursor-pointer text-xs uppercase tracking-wider"
                  >
                    Quiz Center
                  </button>
                  
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="flex-1 inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-cyan-400 via-sky-400 to-blue-500 text-slate-950 font-black shadow-[0_4px_0_#1e3a8a] active:translate-y-0.5 transition duration-150 cursor-pointer text-xs uppercase tracking-wider"
                  >
                    Dashboard
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Active test view */
          <div className="absolute inset-0 flex flex-col overflow-hidden">
            <div className="border-b border-white/10 bg-slate-950/20 px-4 py-3 flex items-center justify-between shrink-0">
              <div className="min-w-0">
                <span className="text-[9px] font-black uppercase text-cyan-200 tracking-wider">MOCK EVALUATION ({currentIdx + 1}/{questions.length})</span>
                <h3 className="text-base sm:text-lg font-black text-white truncate">{activeSubject}: {activeChapter}</h3>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-rose-300/20 bg-rose-300/10 px-3 py-1.5 text-rose-200 text-xs font-black shrink-0">
                <Timer size={15} />
                <span>{formattedTime}</span>
              </div>
            </div>

            <div className="thin-scrollbar flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              <div className="glass p-5 rounded-2xl border border-white/12 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-cyan-200 uppercase tracking-widest">Question {currentIdx + 1} of {questions.length}</span>
                  <span className="rounded-lg border border-slate-700 bg-slate-800/50 px-2 py-0.5 text-[9px] text-slate-300 font-bold uppercase tracking-wider">
                    {questions[currentIdx].difficulty} • {questions[currentIdx].bloom_level} • {questions[currentIdx].type}
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
                      placeholder={
                        questions[currentIdx].type === 'Fill in the Blanks'
                          ? "Enter the missing word here..."
                          : questions[currentIdx].type === 'One Word'
                          ? "Enter your one-word answer..."
                          : questions[currentIdx].type === 'Full Forms'
                          ? "Enter the complete expanded form..."
                          : "Write your descriptive answer here..."
                      }
                      className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.05] p-3 text-white outline-none focus:border-cyan-200/60 text-xs sm:text-sm"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions Navigation */}
            <div className="border-t border-white/10 bg-slate-950/20 px-4 py-3.5 flex items-center justify-between shrink-0">
              <button
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx((prev) => prev - 1)}
                className="inline-flex h-10 px-4 items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 text-slate-200 text-xs font-bold disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft size={16} /> Prev
              </button>

              {currentIdx < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentIdx((prev) => prev + 1)}
                  className="inline-flex h-10 px-4 items-center justify-center gap-1 rounded-xl bg-gradient-to-br from-white/10 to-white/5 text-slate-100 text-xs font-bold hover:bg-white/10 cursor-pointer"
                >
                  Next <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  onClick={handleFinishTest}
                  className="inline-flex h-10 px-5 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-emerald-300 via-teal-300 to-cyan-400 text-slate-950 font-black shadow-[0_4px_0_#047857] active:translate-y-0.5 transition duration-150 cursor-pointer text-xs uppercase tracking-wider"
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
