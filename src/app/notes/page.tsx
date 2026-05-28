'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Download, Search, Sparkles, X, Bot, ArrowRight, GraduationCap } from 'lucide-react';
import AppShell from '@/components/AppShell';
import jsPDF from 'jspdf';

interface ChapterNotes {
  title: string;
  summary: string;
  keyPoints: string[];
  formulas: string[];
}

interface SubjectNotes {
  subject: string;
  color: string;
  chapters: ChapterNotes[];
}

const notesData: SubjectNotes[] = [
  {
    subject: 'Physics',
    color: 'from-cyan-400 to-blue-500',
    chapters: [
      {
        title: 'Kinematics',
        summary: 'Study of motion of objects without considering the forces that cause the motion.',
        keyPoints: [
          'Distance is a scalar, whereas Displacement is a vector quantity representing the shortest path.',
          'Average Speed is total distance divided by total time. Average Velocity is total displacement divided by total time.',
          'Acceleration measures the rate of change of velocity over time.',
          'Equations of motion apply ONLY when acceleration is constant.'
        ],
        formulas: [
          'v = u + at (Velocity-time relation)',
          's = ut + (1/2)at² (Displacement-time relation)',
          'v² = u² + 2as (Velocity-displacement relation)',
          's = ((u + v)/2)t (Alternative displacement equation)'
        ]
      },
      {
        title: 'Modern Physics',
        summary: 'Focuses on the twin pillars of relativity and quantum mechanics, exploring matter and energy at atomic scales.',
        keyPoints: [
          'Photoelectric Effect: Light behaves as packets of energy called photons. Einstein explained this by showing electrons are emitted only if the photon energy exceeds the work function.',
          'De Broglie Wavelength: Particles of matter like electrons exhibit wave-like characteristics.',
          'Nuclear Fission: Splitting of a heavy nucleus into lighter nuclei with a massive release of energy.'
        ],
        formulas: [
          'E = hν = hc/λ (Photon energy)',
          'Kmax = hν - Φ (Einstein photoelectric equation)',
          'λ = h/p = h/(mv) (De Broglie wavelength)',
          'E = Δmc² (Mass-energy equivalence)'
        ]
      }
    ]
  },
  {
    subject: 'Chemistry',
    color: 'from-emerald-400 to-teal-500',
    chapters: [
      {
        title: 'Organic Chemistry',
        summary: 'Deep study of the structures, properties, compositions, reactions, and synthesis of carbon-based compounds.',
        keyPoints: [
          'Tetravalency of Carbon: Carbon forms four covalent bonds due to its four valence electrons.',
          'Hybridization: Carbon exhibits sp³, sp², and sp hybridization depending on single, double, or triple bonds.',
          'Functional Groups: Specific atom clusters like hydroxyl (-OH) or carboxyl (-COOH) dictate chemical reactivity.'
        ],
        formulas: [
          'C_n H_{2n+2} (Alkanes general formula)',
          'C_n H_{2n} (Alkenes general formula)',
          'C_n H_{2n-2} (Alkynes general formula)'
        ]
      }
    ]
  },
  {
    subject: 'Mathematics',
    color: 'from-amber-400 to-orange-500',
    chapters: [
      {
        title: 'Calculus & Limits',
        summary: 'Mathematical study of continuous change, split into differential (rates of change) and integral (accumulations) calculus.',
        keyPoints: [
          'Limits define the value a function approaches as the input approaches some value.',
          'Derivative represents the instantaneous rate of change or the slope of the tangent line to the curve.',
          'Integration is the reverse process of differentiation, representing the area under a curve.'
        ],
        formulas: [
          'd/dx(x^n) = n·x^{n-1} (Power rule)',
          'd/dx(ln x) = 1/x (Logarithmic derivative)',
          '∫ x^n dx = [x^{n+1} / (n+1)] + C (Power rule for integration)'
        ]
      }
    ]
  }
];

export default function NotesPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeSubject, setActiveSubject] = useState('Physics');
  const [selectedChapter, setSelectedChapter] = useState<ChapterNotes | null>(null);

  const filteredNotes = notesData.find(s => s.subject === activeSubject);

  const searchedChapters = filteredNotes?.chapters.filter(ch => 
    ch.title.toLowerCase().includes(search.toLowerCase()) || 
    ch.summary.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleDownloadPDF = (chapter: ChapterNotes, subjectName: string) => {
    const doc = new jsPDF();
    
    // Premium gold-themed boarder
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(1.5);
    doc.rect(5, 5, 200, 287);
    
    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(5, 8, 22);
    doc.text("SIR GANGULY'S EDUCATION PLATFORM", 20, 25);
    
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text(`Subject: ${subjectName}  |  Chapter: ${chapter.title}`, 20, 35);
    
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(20, 40, 190, 40);
    
    // Summary Section
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text("1. CONCEPT SUMMARY", 20, 52);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    const summaryLines = doc.splitTextToSize(chapter.summary, 170);
    doc.text(summaryLines, 20, 60);
    
    // Key Points
    let currentY = 60 + (summaryLines.length * 6) + 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text("2. KEY CONCEPTS & LEARNING POINTS", 20, currentY);
    currentY += 8;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    chapter.keyPoints.forEach((point, idx) => {
      const bullet = `${idx + 1}. `;
      const lines = doc.splitTextToSize(point, 160);
      doc.text(bullet, 20, currentY);
      doc.text(lines, 26, currentY);
      currentY += (lines.length * 6) + 3;
    });
    
    // Formulas
    currentY += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text("3. VITAL FORMULAS & EQUATIONS", 20, currentY);
    currentY += 8;
    
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(12);
    doc.setTextColor(5, 8, 22);
    chapter.formulas.forEach((formula) => {
      doc.text(`*  ${formula}`, 25, currentY);
      currentY += 8;
    });
    
    // Footer
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text("Generated securely via Question Bank AI Ecosystem", 20, 280);
    doc.text("Copyright © Susanto Ganguly", 145, 280);
    
    doc.save(`Sir_Ganguly_Notes_${chapter.title.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <AppShell>
      <div className="flex h-full flex-col overflow-hidden bg-slate-950/40 text-left">
        
        {/* Header Section */}
        <header className="border-b border-white/10 bg-slate-950/20 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-[10px] font-black uppercase text-cyan-200 tracking-widest">Premium Learning Material</span>
              <h2 className="text-xl sm:text-3xl font-black text-white mt-0.5">SIR GANGULY'S NOTES</h2>
              <p className="text-xs text-slate-400 mt-0.5">High-quality, conceptual, board-aligned notes prepared by Sir Ganguly.</p>
            </div>
            
            {/* Search */}
            <label className="flex h-11 w-full max-w-sm items-center gap-2 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-1">
              <Search size={16} className="text-slate-400" />
              <input 
                type="text" 
                placeholder="Search notes..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500" 
              />
            </label>
          </div>

          {/* Subject Tabs */}
          <div className="flex items-center gap-2 mt-5 overflow-x-auto pb-1">
            {notesData.map((data) => (
              <button
                key={data.subject}
                onClick={() => {
                  setActiveSubject(data.subject);
                  setSelectedChapter(null);
                }}
                className={`px-4 py-2 text-xs font-black rounded-lg transition duration-200 cursor-pointer ${
                  activeSubject === data.subject
                    ? `bg-gradient-to-r ${data.color} text-slate-950 shadow-lg`
                    : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                }`}
              >
                {data.subject}
              </button>
            ))}
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto thin-scrollbar p-4 sm:p-6">
          {searchedChapters.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-6xl">
              {searchedChapters.map((chapter) => (
                <motion.div
                  key={chapter.title}
                  layoutId={`chapter-card-${chapter.title}`}
                  onClick={() => setSelectedChapter(chapter)}
                  className="group relative rounded-2xl border border-white/10 bg-slate-900/40 p-5 hover:border-cyan-200/30 transition duration-300 hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-black text-white group-hover:text-cyan-200 transition">{chapter.title}</h4>
                      <BookOpen size={16} className="text-slate-500 group-hover:text-cyan-300 transition" />
                    </div>
                    <p className="text-xs leading-5 text-slate-400">{chapter.summary}</p>
                  </div>
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadPDF(chapter, activeSubject);
                      }}
                      className="inline-flex h-9 px-3 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 text-[10px] uppercase tracking-wider font-bold text-slate-200 hover:bg-white/10 transition"
                      title="Download notes PDF"
                    >
                      <Download size={13} /> PDF
                    </button>
                    <span className="text-[10px] font-black uppercase text-cyan-200 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                      Read online <ArrowRight size={12} />
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center space-y-3">
              <GraduationCap size={48} className="mx-auto text-slate-600" />
              <h4 className="text-lg font-black text-slate-300">No chapters found</h4>
              <p className="text-xs text-slate-500">Try adjusting your search criteria or subject selection.</p>
            </div>
          )}
        </main>

        {/* Notes Drawer Details Overlay */}
        <AnimatePresence>
          {selectedChapter ? (
            <motion.div 
              className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm p-4 sm:p-6 flex justify-end"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={e => e.target === e.currentTarget && setSelectedChapter(null)}
            >
              <motion.div
                layoutId={`chapter-card-${selectedChapter.title}`}
                className="max-h-full w-full max-w-lg overflow-hidden rounded-2xl border border-white/15 bg-slate-950 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col justify-between"
              >
                {/* Header */}
                <div className="flex items-start justify-between pb-4 border-b border-white/10">
                  <div>
                    <span className="text-[9px] font-black uppercase text-cyan-200 tracking-widest">{activeSubject} Summary Notes</span>
                    <h3 className="text-xl sm:text-2xl font-black text-white">{selectedChapter.title}</h3>
                  </div>
                  <button 
                    onClick={() => setSelectedChapter(null)} 
                    className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-300"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Details Scroll Area */}
                <div className="flex-1 overflow-y-auto thin-scrollbar space-y-5 my-4 pr-1 text-slate-300">
                  <div className="space-y-1.5">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Summary Concept</h5>
                    <p className="text-xs sm:text-sm leading-relaxed text-slate-300">{selectedChapter.summary}</p>
                  </div>

                  <div className="space-y-2">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Key Conceptual Pillars</h5>
                    <ul className="space-y-2">
                      {selectedChapter.keyPoints.map((point, idx) => (
                        <li key={idx} className="flex gap-2 text-xs leading-5 text-slate-300">
                          <span className="text-cyan-200 font-bold shrink-0">{idx + 1}.</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Core Formulas</h5>
                    <div className="space-y-2.5">
                      {selectedChapter.formulas.map((formula, idx) => (
                        <div key={idx} className="rounded-lg border border-white/5 bg-white/[0.03] p-3 text-xs sm:text-sm font-semibold italic text-cyan-100 font-mono">
                          {formula}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3">
                  <button
                    onClick={() => handleDownloadPDF(selectedChapter, activeSubject)}
                    className="inline-flex h-11 px-4 items-center gap-2 rounded-xl bg-gradient-to-br from-cyan-300 to-blue-400 font-black text-slate-950 text-xs uppercase tracking-wider shadow-[0_5px_0_rgba(15,23,42,0.8)] active:translate-y-1 transition cursor-pointer"
                  >
                    <Download size={14} /> Download PDF Notes
                  </button>
                  <button
                    onClick={() => router.push('/avatar')}
                    className="inline-flex h-11 px-4 items-center gap-2 rounded-xl border border-white/10 bg-white/5 font-black text-cyan-200 text-xs uppercase tracking-wider hover:bg-white/10 transition cursor-pointer"
                  >
                    <Bot size={14} /> Ask AI Avatar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

      </div>
    </AppShell>
  );
}
