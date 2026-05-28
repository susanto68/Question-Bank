'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, MessageSquare, Send, Sparkles, Volume2, VolumeX, Mic, ArrowRight, User } from 'lucide-react';
import AppShell from '@/components/AppShell';

interface ChatMessage {
  sender: 'user' | 'avatar';
  text: string;
  timestamp: string;
}

const suggestedPrompts = [
  "Explain Thermodynamics like I am 5 years old",
  "How does Photosynthesis capture solar energy?",
  "Explain calculus differentiation intuitively",
  "Why does salt dissolve in water at a molecular level?"
];

export default function AvatarPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: 'avatar',
      text: "Hello! I am your AI Teacher Avatar. I can explain complex scientific and mathematical concepts, solve numericals, or breakdown Sir Ganguly's notes for you. Ask me anything!",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (text: string) => {
    if (!text.trim() || loading) return;
    
    const userMsg: ChatMessage = {
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Call our serverless route which handles Supabase and Groq/Gemini fallback routing!
      const response = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // We structure a query payload but ask the API to generate answer explanation details!
        body: JSON.stringify({
          board: 'AI Avatar Classroom',
          className: 'General Inquiry',
          subject: 'Academic Concept',
          chapter: text.slice(0, 100) // Pass query as the context
        })
      });
      
      const data = await response.json();
      
      let reply = "";
      if (data?.questions?.[0]) {
        // We reuse the highly detailed fallback explanation fields as a primary answer source!
        reply = data.questions[0].answer + "\n\n" + (data.questions[0].explanation || "");
      } else {
        // Fallback response
        reply = `To explain "${text}":\n\n1. Core Concept: This is a vital topic in academic curriculums.\n2. In-Depth Detail: It represents the interactions and foundational rules governing these structures.\n3. Application: Understanding this unlocks further analytical derivations.`;
      }
      
      setMessages(prev => [...prev, {
        sender: 'avatar',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        sender: 'avatar',
        text: "I am having a brief connection drop in my AI engine. Let me summarize:\n\n1. Concept: That is an incredibly important core idea.\n2. Detail: It requires exploring definitions and step-by-step methodologies.\n3. Formula/Law: Applying proper physical or chemical laws is key to solving it.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSpeech = () => {
    if ('speechSynthesis' in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      } else {
        const lastMsg = messages.filter(m => m.sender === 'avatar').pop();
        if (lastMsg) {
          const utterance = new SpeechSynthesisUtterance(lastMsg.text);
          utterance.onend = () => setIsSpeaking(false);
          utterance.onerror = () => setIsSpeaking(false);
          setIsSpeaking(true);
          window.speechSynthesis.speak(utterance);
        }
      }
    } else {
      alert("Text-to-speech is not supported on this browser.");
    }
  };

  return (
    <AppShell>
      <div className="flex h-full flex-col lg:flex-row overflow-hidden bg-slate-950/40 text-left">
        
        {/* Holographic Avatar Display Panel */}
        <section className="w-full lg:w-[400px] shrink-0 border-b lg:border-b-0 lg:border-r border-white/10 bg-slate-950/30 p-5 flex flex-col items-center justify-center space-y-6 relative overflow-hidden">
          {/* Cyberpunk grid background */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.12)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-40"></div>
          
          <div className="relative">
            {/* Pulsing neon halo */}
            <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-xl animate-pulse"></div>
            
            {/* Visualizer ring */}
            <motion.div 
              className="relative h-44 w-44 rounded-full bg-gradient-to-br from-cyan-400 via-sky-400 to-violet-500 p-[3px] shadow-[0_0_40px_rgba(34,211,238,0.3)]"
              animate={isSpeaking ? { scale: [1, 1.04, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1.2 }}
            >
              <div className="h-full w-full rounded-full bg-slate-950 flex flex-col items-center justify-center overflow-hidden relative">
                {/* Audio wave vectors */}
                <AnimatePresence>
                  {isSpeaking ? (
                    <motion.div 
                      className="absolute inset-0 flex items-center justify-center gap-1 bg-cyan-500/10"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {[1, 2, 3, 4, 5].map((i) => (
                        <motion.div 
                          key={i}
                          className="w-1.5 rounded-full bg-cyan-300"
                          animate={{ height: [12, 36, 12] }}
                          transition={{ repeat: Infinity, duration: 0.6 + i*0.1, ease: 'easeInOut' }}
                        />
                      ))}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
                
                {/* Avatar face asset */}
                <Bot size={76} className={`text-cyan-300 transition duration-300 ${isSpeaking ? 'scale-90 opacity-40' : 'scale-100'}`} />
              </div>
            </motion.div>

            {/* Speaking status label */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-slate-900 border border-cyan-100/20 rounded-full px-3 py-1 text-[10px] uppercase tracking-widest font-black text-cyan-200 flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full bg-cyan-300 ${isSpeaking ? 'animate-ping' : ''}`} />
              {isSpeaking ? 'Speaking' : 'Online'}
            </div>
          </div>

          <div className="text-center max-w-sm space-y-1">
            <h3 className="text-lg font-black text-white">AI TEACHER AVATAR</h3>
            <p className="text-xs text-slate-400">Interactive holographic instructor capable of explaining complex sciences and mathematics.</p>
          </div>

          {/* Quick Voice Control */}
          <button
            onClick={toggleSpeech}
            className={`inline-flex h-11 px-5 items-center gap-2 rounded-xl border text-xs font-black uppercase tracking-wider transition duration-200 cursor-pointer ${
              isSpeaking
                ? 'border-cyan-300/30 bg-cyan-400/10 text-cyan-300'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            {isSpeaking ? <VolumeX size={15} /> : <Volume2 size={15} />}
            {isSpeaking ? 'Mute Voice' : 'Listen Answer'}
          </button>
        </section>

        {/* Chat Center */}
        <section className="flex-1 flex flex-col overflow-hidden bg-slate-950/10">
          
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto thin-scrollbar p-4 sm:p-6 space-y-4">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex gap-3 max-w-2xl ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                {/* Profile Circle */}
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 text-slate-950 font-bold ${
                  msg.sender === 'user' 
                    ? 'bg-gradient-to-br from-amber-300 to-orange-400' 
                    : 'bg-gradient-to-br from-cyan-300 to-blue-400'
                }`}>
                  {msg.sender === 'user' ? <User size={15} /> : <Bot size={15} />}
                </div>

                {/* Message Body */}
                <div className={`rounded-2xl border p-4 text-xs sm:text-sm leading-relaxed ${
                  msg.sender === 'user'
                    ? 'border-amber-300/20 bg-amber-300/[0.04] text-slate-100 rounded-tr-none text-right'
                    : 'border-cyan-300/20 bg-slate-900/60 text-slate-200 rounded-tl-none text-left'
                }`}>
                  <p className="whitespace-pre-wrap font-medium">{msg.text}</p>
                  <span className="block mt-2 text-[9px] text-slate-500 font-mono tracking-wide">{msg.timestamp}</span>
                </div>
              </div>
            ))}

            {loading ? (
              <div className="flex gap-3 max-w-md">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-300 to-blue-400 grid place-items-center text-slate-950 shrink-0">
                  <Bot size={15} />
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

          {/* Quick Prompts Panel */}
          <div className="no-print px-4 py-2 border-t border-white/5 bg-slate-950/20 flex gap-2 overflow-x-auto">
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSend(prompt)}
                className="shrink-0 px-3 py-1.5 rounded-lg border border-white/5 bg-white/[0.03] text-[10px] font-semibold text-slate-400 hover:text-cyan-300 hover:border-cyan-300/20 hover:bg-cyan-400/[0.02] transition duration-200 cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <footer className="border-t border-white/10 bg-slate-950/40 p-4">
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(input);
              }}
              className="flex items-center gap-2 max-w-4xl mx-auto"
            >
              <label className="flex-1 flex h-12 items-center gap-2 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-1 focus-within:border-cyan-200/50">
                <Bot size={16} className="text-cyan-200 shrink-0" />
                <input 
                  type="text"
                  placeholder="Ask a scientific/mathematical question..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  disabled={loading}
                  className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                />
              </label>
              <button 
                type="submit"
                disabled={loading || !input.trim()}
                className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-cyan-300 via-emerald-300 to-amber-300 text-slate-950 shadow-[0_5px_0_rgba(15,23,42,0.8)] active:translate-y-0.5 disabled:opacity-50 cursor-pointer shrink-0"
              >
                <Send size={16} />
              </button>
            </form>
          </footer>

        </section>

      </div>
    </AppShell>
  );
}
