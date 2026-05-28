'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, UploadCloud, Search, Sparkles, Star, Award, Compass, ArrowRight, UserCheck, Terminal } from 'lucide-react';
import AppShell from '@/components/AppShell';

interface JobCard {
  title: string;
  company: string;
  location: string;
  salary: string;
  tags: string[];
}

const jobOpenings: JobCard[] = [
  {
    title: "AI Curriculum Architect",
    company: "Ganguly EdTech Systems",
    location: "Kolkata, IN (Hybrid)",
    salary: "₹18L - ₹24L per annum",
    tags: ["AI in Education", "Next.js", "Llama Models", "Curriculum Design"]
  },
  {
    title: "Full-Stack Senior Engineer",
    company: "Future Learning Labs",
    location: "Bengaluru, IN (Remote)",
    salary: "₹22L - ₹30L per annum",
    tags: ["React 19", "Next.js 16", "Supabase", "TypeScript"]
  },
  {
    title: "Deep Learning Instructor",
    company: "Advanced Academy of Sciences",
    location: "Mumbai, IN (On-Site)",
    salary: "₹15L - ₹20L per annum",
    tags: ["PyTorch", "NLP", "LLM Fine-tuning", "Mentorship"]
  }
];

const roadmaps: Record<string, string[]> = {
  "AI Engineer": [
    "Step 1: Master Python Programming, Linear Algebra, and Calculus foundations.",
    "Step 2: Learn classical Machine Learning (Scikit-Learn, regressions, clustering).",
    "Step 3: Dive deep into Neural Networks & Deep Learning frameworks (PyTorch, TensorFlow).",
    "Step 4: Specialize in Large Language Models (LLMs), prompt engineering, and fine-tuning API integrations."
  ],
  "Software Architect": [
    "Step 1: Solidify algorithms, design patterns, and OOP principles.",
    "Step 2: Master system designs, caching strategies, and database normalizations.",
    "Step 3: Excel in distributed systems, microservices, and serverless platforms (Next.js, Vercel).",
    "Step 4: Perfect security compliance, containerizations (Docker, K8s), and cloud operations."
  ],
  "EdTech Content Director": [
    "Step 1: Build deep pedagogical and syllabus framework expertise (ICSE, CBSE, College levels).",
    "Step 2: Understand digital learning management systems (LMS) and multimedia pipelines.",
    "Step 3: Integrate AI generators into real-time curriculum creation pipelines.",
    "Step 4: Lead educational avatar designs and parent/teacher dashboard integrations."
  ]
};

export default function CareerPage() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [careerPath, setCareerPath] = useState('');
  const [activeRoadmap, setActiveRoadmap] = useState<string[] | null>(null);

  const handleFileChange = (e: any) => {
    if (e.target.files?.[0]) {
      setSelectedFile(e.target.files[0].name);
      triggerAnalysis(e.target.files[0].name);
    }
  };

  const triggerAnalysis = (filename: string) => {
    setAnalyzing(true);
    setAnalysisResult(null);
    setTimeout(() => {
      setAnalyzing(false);
      setAnalysisResult({
        score: 87,
        strengths: ["Strong modern Tech Stack (React, Next.js, TypeScript)", "Experience with relational databases (Supabase, PostgreSQL)", "Solid structural knowledge"],
        recommendations: ["Add more direct LLM fine-tuning or AI generation projects", "Expand portfolio with clinical or scientific databases linkings", "Include Docker/Kubernetes system credentials"]
      });
    }, 2800);
  };

  const handleGenerateRoadmap = (path: string) => {
    setCareerPath(path);
    setActiveRoadmap(roadmaps[path] || null);
  };

  return (
    <AppShell>
      <div className="flex h-full flex-col overflow-y-auto thin-scrollbar bg-slate-950/40 text-left p-4 sm:p-6">
        
        {/* Header Section */}
        <section className="mb-6 space-y-2">
          <span className="text-[10px] font-black uppercase text-amber-200 tracking-widest">Guidance & Placement Hub</span>
          <h2 className="text-2xl sm:text-4xl font-black text-white">AI CAREER GUIDANCE & JOBS</h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
            Upload your resume for futuristic skill-matching reviews, explore exclusive educational placements, or generate custom step-by-step career path roadmaps.
          </p>
        </section>

        {/* Top Grid: Resume Scanner & Roadmap Generator */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 max-w-7xl">
          
          {/* Resume Scanner Panel */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5 sm:p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <UploadCloud className="text-cyan-300" size={20} />
                <h4 className="text-lg font-black text-white">Futuristic Resume Scanner</h4>
              </div>
              <p className="text-xs text-slate-400">
                Drag-and-drop or select your PDF resume. Our AI model will perform a real-time parsing matching, grading strengths and indexing vital skill voids.
              </p>
              
              {/* Drop area */}
              <label className="border-2 border-dashed border-white/10 hover:border-cyan-300/35 rounded-xl p-6 text-center cursor-pointer flex flex-col items-center justify-center gap-2 bg-slate-950/20 transition group">
                <input type="file" accept=".pdf,.doc,.docx" onChange={handleFileChange} className="hidden" />
                <UploadCloud className="text-slate-500 group-hover:text-cyan-200 transition" size={32} />
                <span className="text-xs font-black text-slate-300 group-hover:text-white transition">
                  {selectedFile ? `Selected: ${selectedFile}` : 'Upload Resume PDF / DOC'}
                </span>
                <span className="text-[10px] text-slate-500">Max size 5MB</span>
              </label>

              {/* Loader */}
              {analyzing ? (
                <div className="p-4 border border-cyan-300/20 bg-cyan-400/[0.02] rounded-xl flex items-center justify-center gap-2">
                  <div className="h-4 w-4 rounded-full border-2 border-cyan-300 border-t-transparent animate-spin" />
                  <span className="text-xs font-black text-cyan-200 uppercase tracking-widest">AI Scanner Analyzing...</span>
                </div>
              ) : null}

              {/* Analysis Result */}
              <AnimatePresence>
                {analysisResult ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 p-4 border border-white/10 bg-slate-950/40 rounded-xl"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-500">Resume Match Score</span>
                      <div className="inline-flex items-center gap-1 text-sm font-black text-emerald-300 bg-emerald-400/10 px-2 py-0.5 rounded-lg border border-emerald-400/20">
                        <Award size={14} /> {analysisResult.score}% Match
                      </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Key Strengths</span>
                      <ul className="space-y-1 text-xs text-slate-300">
                        {analysisResult.strengths.map((str: string, idx: number) => (
                          <li key={idx} className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {str}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Recommendations</span>
                      <ul className="space-y-1 text-xs text-slate-300">
                        {analysisResult.recommendations.map((rec: string, idx: number) => (
                          <li key={idx} className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

          {/* Interactive Career Roadmap Builder */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5 sm:p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Compass className="text-amber-300" size={20} />
                <h4 className="text-lg font-black text-white">AI Skill Roadmap Architect</h4>
              </div>
              <p className="text-xs text-slate-400">
                Choose a futuristic objective below, and our advanced AI engine will output an indexed milestone roadmap mapping target skills.
              </p>
              
              <div className="flex flex-wrap gap-2">
                {Object.keys(roadmaps).map((path) => (
                  <button
                    key={path}
                    onClick={() => handleGenerateRoadmap(path)}
                    className={`px-3 py-2 text-xs font-black rounded-lg transition duration-200 cursor-pointer ${
                      careerPath === path
                        ? 'bg-gradient-to-r from-amber-300 to-orange-400 text-slate-950 shadow-lg'
                        : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {path}
                  </button>
                ))}
              </div>

              {/* Active Roadmap Output */}
              <AnimatePresence>
                {activeRoadmap ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3 p-4 border border-white/10 bg-slate-950/40 rounded-xl"
                  >
                    <span className="text-[10px] font-black uppercase text-amber-200 tracking-widest">{careerPath} Path Milestones</span>
                    <div className="space-y-3">
                      {activeRoadmap.map((step, idx) => (
                        <div key={idx} className="flex gap-2.5 items-start text-xs sm:text-sm">
                          <div className="h-5 w-5 rounded-full border border-amber-300/30 bg-amber-400/10 grid place-items-center font-bold text-amber-200 text-[10px] shrink-0 mt-0.5">
                            {idx + 1}
                          </div>
                          <p className="leading-5 text-slate-300 font-semibold">{step}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>

        </div>

        {/* Placement Section: Job Openings */}
        <section className="max-w-7xl space-y-4">
          <div>
            <span className="text-[10px] font-black uppercase text-cyan-200 tracking-widest">Active Placements</span>
            <h3 className="text-xl sm:text-2xl font-black text-white">EXCLUSIVE JOB OPENINGS</h3>
            <p className="text-xs text-slate-400">Exclusive educational technology and developer roles. Apply instantly with your matched profile.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobOpenings.map((job) => (
              <div 
                key={job.title}
                className="group relative rounded-2xl border border-white/10 bg-slate-900/40 p-5 hover:border-cyan-200/30 transition duration-300 flex flex-col justify-between space-y-6"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-base sm:text-lg font-black text-white group-hover:text-cyan-200 transition leading-snug">{job.title}</h4>
                      <p className="text-xs font-bold text-slate-400">{job.company}</p>
                    </div>
                    <Briefcase size={16} className="text-slate-500 group-hover:text-cyan-300 transition" />
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">{job.location}</p>
                    <p className="text-xs font-black text-cyan-100">{job.salary}</p>
                  </div>

                  <div className="flex flex-wrap gap-1 mt-2">
                    {job.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[9px] font-black text-slate-400 uppercase tracking-wide">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => alert(`Applying to ${job.title} at ${job.company} via profile data!`)}
                  className="w-full inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 font-black text-slate-200 text-xs hover:bg-white/10 transition uppercase tracking-wider cursor-pointer"
                >
                  <UserCheck size={14} /> Quick Apply
                </button>
              </div>
            ))}
          </div>
        </section>

      </div>
    </AppShell>
  );
}
