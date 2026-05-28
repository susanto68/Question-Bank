'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Calendar, MessageSquare, Send, Sparkles, X, ChevronRight, GraduationCap, Award, Compass } from 'lucide-react';
import AppShell from '@/components/AppShell';

interface Mentor {
  name: string;
  role: string;
  avatarSeed: string;
  color: string;
  specialty: string;
  persona: string;
  intro: string;
}

const mentors: Mentor[] = [
  {
    name: "Dr. Ananya Sen",
    role: "Board Exam Specialist",
    avatarSeed: "ananya",
    color: "from-cyan-400 to-blue-500",
    specialty: "Board strategy, schedule building, stress relief",
    persona: "Encouraging, structured, focus-oriented",
    intro: "Hello! I am Dr. Ananya. I can help you draft optimized board preparation timetables, learn stress management techniques, and maximize your score in ICSE & CBSE exams. How can I help you prepare today?"
  },
  {
    name: "Vikram Malhotra",
    role: "AI & Tech Career Strategist",
    avatarSeed: "vikram",
    color: "from-amber-400 to-orange-500",
    specialty: "Resume crafting, portfolio design, technology choices",
    persona: "Direct, logical, industry-focused",
    intro: "Hey! Vikram here. Let's get right to business. I specialize in mapping skills, finding internship voids, and building high-income portfolios. What career path or industry are we targeting?"
  },
  {
    name: "Prof. Rajat Ganguly",
    role: "Physics & Core Sciences Coach",
    avatarSeed: "rajat",
    color: "from-emerald-400 to-teal-500",
    specialty: "Conceptual doubts, derivation analysis, problem solving",
    persona: "Analytical, pedagogical, conceptual",
    intro: "Greetings. I am Prof. Rajat. I believe in conceptual clarity first. Once you understand the physical mechanism, derivations and numericals flow naturally. What physics or science concept is bothering you?"
  }
];

interface ChatMessage {
  sender: 'user' | 'mentor';
  text: string;
  timestamp: string;
}

export default function MentorPage() {
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const handleStartChat = (mentor: Mentor) => {
    setSelectedMentor(mentor);
    setBookingSuccess(false);
    setChatMessages([
      {
        sender: 'mentor',
        text: mentor.intro,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !selectedMentor || chatLoading) return;

    const userText = chatInput;
    setChatMessages(prev => [...prev, {
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    setChatInput('');
    setChatLoading(true);

    try {
      // Simulate specialized mentor response matching their persona
      setTimeout(() => {
        let reply = "";
        if (selectedMentor.role.includes("Board")) {
          reply = `That is a common hurdle during board preparations. In my experience:\n\n1. **Focus on Quality**: Study in concentrated 45-minute blocks instead of continuous hours.\n2. **Previous Years**: Solving the past 5 years of board papers accounts for 75% of conceptual repetitions.\n3. **Clarity**: Write answers using bullet points and highlight key terms.`;
        } else if (selectedMentor.role.includes("Career")) {
          reply = `Understood. To tackle this, let's establish direct targets:\n\n1. **Build Projects**: Theory is useless without active implementations. Deploy an app on GitHub.\n2. **Networking**: Share your learnings publicly. It is the single highest-value career driver.\n3. **Certificates**: Ensure you obtain validated achievement credentials to show on your CV.`;
        } else {
          reply = `Let's break down this concept logically:\n\n1. **First Principles**: Go back to the core physical definitions before looking at the formulas.\n2. **Analogy**: Think of it like a fluid flowing through pipe limits.\n3. **Practice**: Let's write down the variables we know and map them to our equations step-by-step.`;
        }

        setChatMessages(prev => [...prev, {
          sender: 'mentor',
          text: reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        setChatLoading(false);
      }, 1800);
    } catch (e) {
      setChatLoading(false);
    }
  };

  const handleBookSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingDate || !bookingTime) return;
    setBookingSuccess(true);
  };

  return (
    <AppShell>
      <div className="flex h-full flex-col lg:flex-row overflow-hidden bg-slate-950/40 text-left">
        
        {/* Mentor Directory & Booking Sidebar */}
        <section className="w-full lg:w-[420px] shrink-0 border-b lg:border-b-0 lg:border-r border-white/10 bg-slate-950/30 p-5 overflow-y-auto thin-scrollbar flex flex-col space-y-6">
          <div>
            <span className="text-[10px] font-black uppercase text-cyan-200 tracking-widest">Advisory & Counseling</span>
            <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">AI MENTOR ARCHIVE</h3>
            <p className="text-xs text-slate-400 mt-0.5">Connect with specialized digital coaches to resolve doubts, map career objectives, or balance academic stress.</p>
          </div>

          {/* Mentor List */}
          <div className="space-y-3 flex-1">
            {mentors.map((mentor) => (
              <div
                key={mentor.name}
                onClick={() => handleStartChat(mentor)}
                className={`group relative rounded-xl border p-4 transition duration-300 hover:border-cyan-300/30 cursor-pointer flex items-center justify-between ${
                  selectedMentor?.name === mentor.name
                    ? 'border-cyan-300/30 bg-slate-900/80 shadow-[0_4px_20px_rgba(34,211,238,0.08)]'
                    : 'border-white/10 bg-slate-900/30 hover:bg-slate-900/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Robot avatar ring */}
                  <div className={`h-11 w-11 rounded-full bg-gradient-to-br ${mentor.color} p-[1.5px]`}>
                    <div className="h-full w-full rounded-full bg-slate-950 grid place-items-center text-slate-100 font-bold text-sm">
                      {mentor.name.split(' ').pop()?.[0]}
                    </div>
                  </div>
                  
                  <div className="min-w-0">
                    <h4 className="text-sm font-black text-white truncate leading-tight group-hover:text-cyan-200 transition">{mentor.name}</h4>
                    <p className="text-[10px] font-bold text-slate-400 truncate uppercase mt-0.5">{mentor.role}</p>
                  </div>
                </div>

                <ChevronRight size={16} className="text-slate-500 group-hover:text-cyan-300 transition" />
              </div>
            ))}
          </div>

          {/* Booking Section */}
          {selectedMentor ? (
            <div className="border-t border-white/10 pt-4 space-y-3">
              <span className="text-[10px] font-black uppercase text-amber-200 tracking-widest flex items-center gap-1">
                <Calendar size={13} /> Book 1-on-1 counseling slot
              </span>
              <p className="text-[11px] text-slate-400">Book an exclusive direct mentorship session with {selectedMentor.name}.</p>
              
              {bookingSuccess ? (
                <div className="p-3 border border-emerald-400/20 bg-emerald-400/5 rounded-xl text-xs text-emerald-300 font-bold text-center">
                  Session booked! Confirmation sent to your profile.
                </div>
              ) : (
                <form onSubmit={handleBookSession} className="grid grid-cols-2 gap-2">
                  <input
                    required
                    type="date"
                    value={bookingDate}
                    onChange={e => setBookingDate(e.target.value)}
                    className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.05] px-2 text-xs text-slate-300 outline-none focus:border-cyan-200/50"
                  />
                  <input
                    required
                    type="time"
                    value={bookingTime}
                    onChange={e => setBookingTime(e.target.value)}
                    className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.05] px-2 text-xs text-slate-300 outline-none focus:border-cyan-200/50"
                  />
                  <button type="submit" className="col-span-2 inline-flex h-10 w-full items-center justify-center rounded-lg bg-gradient-to-br from-amber-300 to-orange-400 font-black text-slate-950 text-[10px] uppercase tracking-wider shadow-[0_4px_0_rgba(15,23,42,0.85)] active:translate-y-0.5 cursor-pointer">
                    Confirm Session Slot
                  </button>
                </form>
              )}
            </div>
          ) : null}
        </section>

        {/* Live Chat Counseling Portal */}
        <section className="flex-1 flex flex-col overflow-hidden bg-slate-950/10">
          
          {selectedMentor ? (
            <>
              {/* Active Mentor Header */}
              <div className="border-b border-white/10 bg-slate-950/20 p-4 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-lg font-black text-white leading-tight">{selectedMentor.name}</h3>
                  <p className="text-[10px] font-black uppercase text-cyan-200 tracking-wider mt-0.5">
                    {selectedMentor.role} • Persona: {selectedMentor.persona}
                  </p>
                </div>
                
                <div className="hidden sm:block text-right">
                  <span className="text-[9px] font-black uppercase text-slate-500">Specialty</span>
                  <p className="text-xs text-slate-400">{selectedMentor.specialty}</p>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto thin-scrollbar p-4 sm:p-6 space-y-4">
                {chatMessages.map((msg, idx) => (
                  <div 
                    key={idx} 
                    className={`flex gap-3 max-w-2xl ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
                  >
                    {/* Circle Avatar */}
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-slate-950 ${
                      msg.sender === 'user' 
                        ? 'bg-gradient-to-br from-amber-300 to-orange-400' 
                        : `bg-gradient-to-br ${selectedMentor.color}`
                    }`}>
                      {msg.sender === 'user' ? 'ME' : selectedMentor.name.split(' ').pop()?.[0]}
                    </div>

                    {/* Chat Text */}
                    <div className={`rounded-2xl border p-4 text-xs sm:text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'border-amber-300/20 bg-amber-300/[0.04] text-slate-100 rounded-tr-none'
                        : 'border-cyan-300/20 bg-slate-900/60 text-slate-200 rounded-tl-none'
                    }`}>
                      <p className="whitespace-pre-wrap font-medium">{msg.text}</p>
                      <span className="block mt-2 text-[9px] text-slate-500 font-mono">{msg.timestamp}</span>
                    </div>
                  </div>
                ))}

                {chatLoading ? (
                  <div className="flex gap-3 max-w-md">
                    <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${selectedMentor.color} text-slate-950 grid place-items-center font-bold shrink-0`}>
                      {selectedMentor.name.split(' ').pop()?.[0]}
                    </div>
                    <div className="rounded-2xl border border-cyan-300/20 bg-slate-900/60 p-4 flex items-center gap-1.5 rounded-tl-none">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                ) : null}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Footer */}
              <footer className="border-t border-white/10 bg-slate-950/40 p-4">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendChat();
                  }}
                  className="flex items-center gap-2 max-w-4xl mx-auto"
                >
                  <label className="flex-1 flex h-12 items-center gap-2 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-1 focus-within:border-cyan-200/50">
                    <MessageSquare size={16} className="text-slate-400 shrink-0" />
                    <input 
                      type="text"
                      placeholder={`Send a message to ${selectedMentor.name}...`}
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      disabled={chatLoading}
                      className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                    />
                  </label>
                  <button 
                    type="submit"
                    disabled={chatLoading || !chatInput.trim()}
                    className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 via-emerald-300 to-amber-300 text-slate-950 shadow-[0_5px_0_rgba(15,23,42,0.8)] active:translate-y-0.5 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </footer>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 max-w-md mx-auto">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-300 to-violet-400 p-[1.5px] shadow-lg">
                <div className="h-full w-full rounded-[13px] bg-slate-950 grid place-items-center text-cyan-200">
                  <Users size={24} />
                </div>
              </div>
              <div className="space-y-1.5">
                <h4 className="text-lg font-black text-white">No Counselor Selected</h4>
                <p className="text-xs text-slate-400">Select an AI Counselor from the left panel to begin your personalized direct mentorship or stress counseling chat session.</p>
              </div>
            </div>
          )}

        </section>

      </div>
    </AppShell>
  );
}
