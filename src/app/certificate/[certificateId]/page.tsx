'use client';

import { useEffect, useState, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase/client';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import { Sparkles, Download, FileDown, ArrowLeft, ShieldCheck, Award, Printer } from 'lucide-react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

interface CertificateData {
  id: string;
  certificate_id: string;
  student_id: string;
  board: string;
  class_name: string;
  subject: string;
  score: number;
  percentage: number;
  created_at: string;
  students?: {
    name: string;
  };
}

interface PageProps {
  params: Promise<{
    certificateId: string;
  }>;
}

export default function CertificatePage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { certificateId } = resolvedParams;

  const [loading, setLoading] = useState(true);
  const [certData, setCertData] = useState<CertificateData | null>(null);
  const [studentName, setStudentName] = useState('Valued Learner');
  const certificateRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    // Dynamic loading of certificate from Supabase
    const fetchCertificate = async () => {
      try {
        const { data, error } = await supabase
          .from('certificates')
          .select('*, students(name)')
          .eq('id', certificateId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setCertData(data as any);
          if (data.students && (data.students as any).name) {
            setStudentName((data.students as any).name);
          }
        }
      } catch (err) {
        console.error('Failed to load certificate:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCertificate();
  }, [certificateId]);

  // Burst confetti on certificate load
  useEffect(() => {
    if (certData) {
      const duration = 2.5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 28, spread: 360, ticks: 60, zIndex: 1000 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [certData]);

  const handleDownloadPNG = async () => {
    if (!certificateRef.current) return;
    setDownloading(true);

    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#050816',
      });

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Certificate-${certData?.certificate_id || 'achievement'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('PNG download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!certificateRef.current) return;
    setDownloading(true);

    try {
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#050816',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const imgWidth = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, (210 - imgHeight) / 2, imgWidth, imgHeight);
      pdf.save(`Certificate-${certData?.certificate_id || 'achievement'}.pdf`);
    } catch (err) {
      console.error('PDF download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <LoadingState label="Retrieving secure credentials..." />;

  if (!certData) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <EmptyState title="Certificate Not Found" body="We could not find a certificate matching this ID. Ensure the URL is correct." />
      </div>
    );
  }

  const certDate = new Date(certData.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <main className="min-h-screen bg-[#050816] text-white flex flex-col items-center justify-center px-4 py-8 relative">
      {/* Background overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute h-96 w-96 bg-cyan-400 rounded-full blur-[100px] top-1/4 left-1/4"></div>
      </div>

      <div className="w-full max-w-4xl z-10 space-y-6 flex flex-col items-center">
        {/* Actions panel */}
        <div className="w-full flex justify-between items-center no-print">
          <button
            onClick={() => router.push('/')}
            className="inline-flex h-10 px-4 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 text-slate-200 text-xs font-bold hover:bg-white/10 cursor-pointer"
          >
            <ArrowLeft size={16} /> Home
          </button>

          <div className="flex gap-2">
            <button
              onClick={handleDownloadPNG}
              disabled={downloading}
              className="inline-flex h-10 px-4 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-black text-slate-100 cursor-pointer"
              title="Download Certificate as PNG image"
            >
              <Download size={15} />
              <span>PNG</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="inline-flex h-10 px-4 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-yellow-300 to-amber-500 text-slate-950 font-black shadow-md cursor-pointer text-xs"
              title="Download Certificate as high-quality PDF"
            >
              <FileDown size={15} />
              <span>{downloading ? 'Exporting...' : 'PDF'}</span>
            </button>

            <button
              onClick={() => window.print()}
              disabled={downloading}
              className="inline-flex h-10 px-4 items-center justify-center gap-1.5 rounded-xl border border-yellow-300/20 bg-yellow-300/5 hover:bg-yellow-300/10 text-xs font-black text-yellow-300 cursor-pointer"
              title="Print Certificate or Save as System PDF"
            >
              <Printer size={15} />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Certificate body (297mm x 210mm proportional aspect ratio for PDF rendering) */}
        <div
          ref={certificateRef}
          className="certificate-card relative w-full max-w-3xl aspect-[1.414] overflow-hidden rounded-3xl border-4 border-yellow-400/30 bg-slate-950 p-8 sm:p-12 text-center flex flex-col justify-between shadow-[0_0_50px_rgba(34,211,238,0.15)] select-none"
          style={{
            background: 'radial-gradient(circle at 5% 5%, rgba(6, 182, 212, 0.12), transparent 40%), radial-gradient(circle at 95% 95%, rgba(234, 179, 8, 0.08), transparent 40%), linear-gradient(135deg, #020617 0%, #0b153c 100%)',
          }}
        >
          {/* Internal Border with custom cyan/gold accent glow */}
          <div className="absolute inset-4 rounded-xl border border-cyan-500/10 pointer-events-none" />
          <div className="absolute inset-5 rounded-lg border border-yellow-400/5 pointer-events-none" />

          {/* Glowing Tech Corner Brackets */}
          <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-cyan-400/60 rounded-tl-sm pointer-events-none" />
          <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-cyan-400/60 rounded-tr-sm pointer-events-none" />
          <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-yellow-400/60 rounded-bl-sm pointer-events-none" />
          <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-yellow-400/60 rounded-br-sm pointer-events-none" />

          {/* Decorative Corner Network Nodes (matching home page picture) */}
          <svg className="absolute top-0 left-0 w-36 h-36 text-cyan-400/15 pointer-events-none" viewBox="0 0 100 100">
            <path d="M0,20 L30,20 L40,30 L70,30" stroke="currentColor" strokeWidth="0.5" fill="none" />
            <path d="M20,0 L20,30 L30,40 L30,70" stroke="currentColor" strokeWidth="0.5" fill="none" />
            <circle cx="30" cy="20" r="1.5" fill="#22d3ee" className="animate-pulse" />
            <circle cx="40" cy="30" r="1.2" fill="#eab308" />
            <circle cx="30" cy="40" r="1" fill="#22d3ee" />
            <circle cx="70" cy="30" r="1.5" fill="#22d3ee" className="animate-ping" style={{ animationDuration: '3s' }} />
          </svg>

          <svg className="absolute bottom-0 right-0 w-36 h-36 text-yellow-400/10 pointer-events-none" viewBox="0 0 100 100">
            <path d="M100,80 L70,80 L60,70 L30,70" stroke="currentColor" strokeWidth="0.5" fill="none" />
            <path d="M80,100 L80,70 L70,60 L70,30" stroke="currentColor" strokeWidth="0.5" fill="none" />
            <circle cx="70" cy="80" r="1.5" fill="#eab308" className="animate-pulse" />
            <circle cx="60" cy="70" r="1.2" fill="#22d3ee" />
            <circle cx="70" cy="60" r="1" fill="#eab308" />
            <circle cx="30" cy="70" r="1.5" fill="#eab308" className="animate-ping" style={{ animationDuration: '3.5s' }} />
          </svg>

          {/* Futuristic blueprint/alignment rings behind centerpiece */}
          <div className="absolute inset-0 grid place-items-center opacity-[0.06] pointer-events-none">
            <svg className="w-[340px] h-[340px] text-cyan-400 animate-[spin_90s_linear_infinite]" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="0.75" strokeDasharray="5 5" fill="none" />
              <circle cx="100" cy="100" r="72" stroke="currentColor" strokeWidth="0.5" fill="none" />
              <circle cx="100" cy="100" r="55" stroke="currentColor" strokeWidth="0.75" strokeDasharray="15 8 5 8" fill="none" />
              <path d="M100,5 L100,195 M5,100 L195,100" stroke="currentColor" strokeWidth="0.4" />
            </svg>
          </div>

          {/* Watermark Logo Icon (Glowing Central Seal) */}
          <div className="absolute inset-0 grid place-items-center opacity-3 pointer-events-none">
            <Award size={260} className="text-cyan-400/60 filter drop-shadow-[0_0_20px_rgba(6,182,212,0.2)]" />
          </div>

          {/* Header */}
          <div className="space-y-1 sm:space-y-2 relative flex flex-col items-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-[9px] sm:text-[10px] font-black text-cyan-300 uppercase tracking-[0.25em] shadow-[0_0_15px_rgba(6,182,212,0.1)]">
              <Sparkles size={12} className="text-cyan-300" /> certificate of achievement
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-wider bg-gradient-to-r from-cyan-300 via-white to-yellow-300 bg-clip-text text-transparent filter drop-shadow-[0_2px_8px_rgba(6,182,212,0.2)] mt-1">
              QUESTION BANK AI
            </h1>
            <p className="text-[8px] sm:text-[10px] text-slate-400 uppercase tracking-[0.2em] font-semibold">
              unlocking the future of learning • verified credential
            </p>
          </div>

          {/* Recipient */}
          <div className="space-y-1 relative">
            <p className="text-[10px] sm:text-xs text-slate-400 italic font-medium">This achievement certificate is proudly presented to</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white py-1 uppercase tracking-wide filter drop-shadow-[0_2px_8px_rgba(255,255,255,0.15)]">
              {studentName}
            </h2>
            <div className="h-[1px] w-56 bg-gradient-to-r from-transparent via-cyan-400 to-transparent mx-auto relative">
              <div className="absolute top-[-2px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_#22d3ee]" />
            </div>
          </div>

          {/* Validation Details */}
          <div className="space-y-2.5 max-w-xl mx-auto relative px-4 text-center">
            <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed font-medium">
              for successfully demonstrating conceptual mastery in <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-400/25 text-cyan-300 font-bold">{certData.subject}</span> under the <span className="px-2 py-0.5 rounded bg-yellow-500/10 border border-yellow-400/25 text-yellow-300 font-bold">{certData.board}</span> framework ({certData.class_name}).
            </p>
            <p className="text-xs sm:text-[13px] text-slate-300 font-medium">
              Completed with an outstanding score of <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-400/25 text-emerald-300 font-extrabold">{certData.score} out of 10</span> ({certData.percentage}%).
            </p>
          </div>

          {/* Signatures & Stamps */}
          <div className="grid grid-cols-3 items-center pt-2 relative text-left">
            <div>
              <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Verification Date</p>
              <p className="text-xs font-black text-slate-200 mt-1">{certDate}</p>
            </div>

            <div className="grid place-items-center">
              {/* High-Tech Glowing Holographic Seal */}
              <div className="relative h-16 w-16 rounded-full border border-cyan-400/40 bg-slate-900/80 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)] animate-pulse">
                <ShieldCheck size={28} className="text-cyan-300 filter drop-shadow-[0_0_4px_#22d3ee]" />
                {/* Animated outer dashed spin ring */}
                <div className="absolute inset-[-4px] rounded-full border border-dashed border-yellow-400/20 animate-[spin_40s_linear_infinite]" />
              </div>
            </div>

            <div className="text-right">
              <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Secure Hash ID</p>
              <p className="text-xs font-mono font-black text-yellow-300 mt-1 tracking-wider text-right">{certData.certificate_id.substring(0, 18)}...</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
