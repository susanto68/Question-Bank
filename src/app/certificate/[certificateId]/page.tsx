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
          className="certificate-card relative w-full max-w-3xl aspect-[1.414] overflow-hidden rounded-3xl border-[10px] border-double border-yellow-300/40 bg-slate-950 p-8 sm:p-14 text-center flex flex-col justify-between shadow-[0_20px_50px_rgba(253,224,71,0.12)] select-none"
        >
          {/* Internal Border */}
          <div className="absolute inset-4 rounded-xl border border-yellow-300/20 pointer-events-none" />

          {/* Watermark Logo Icon */}
          <div className="absolute inset-0 grid place-items-center opacity-3 pointer-events-none">
            <Award size={280} className="text-yellow-300" />
          </div>

          {/* Header */}
          <div className="space-y-1 relative">
            <div className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-black text-yellow-300 uppercase tracking-[0.25em]">
              <Sparkles size={14} /> certificate of achievement
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-yellow-100 to-yellow-300 bg-clip-text text-transparent">
              AI QUESTION BANK
            </h1>
            <p className="text-[9px] sm:text-[11px] text-slate-400 uppercase tracking-[0.16em]">
              futuristic educational learning ecosystem
            </p>
          </div>

          {/* Recipient */}
          <div className="space-y-2 relative">
            <p className="text-xs sm:text-sm text-slate-400 italic">This achievement certificate is proudly presented to</p>
            <h2 className="text-3xl sm:text-4xl font-black text-white py-1 uppercase tracking-wide">
              {studentName}
            </h2>
            <div className="h-[2px] w-48 bg-gradient-to-r from-transparent via-yellow-300 to-transparent mx-auto" />
          </div>

          {/* Validation Details */}
          <div className="space-y-2 max-w-xl mx-auto relative">
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
              for successfully completing the mock test in <span className="text-yellow-300 font-bold">{certData.subject}</span> under the <span className="text-cyan-200 font-bold">{certData.board}</span> framework ({certData.class_name}) with an outstanding score of <span className="text-emerald-300 font-extrabold">{certData.score} out of 10</span> ({certData.percentage}%).
            </p>
          </div>

          {/* Signatures & Stamps */}
          <div className="grid grid-cols-3 items-end pt-4 relative text-left">
            <div>
              <p className="text-[10px] text-slate-400">Date Issued</p>
              <p className="text-xs font-bold text-slate-200 mt-1">{certDate}</p>
            </div>

            <div className="grid place-items-center">
              <div className="h-14 w-14 rounded-full border border-yellow-300/35 bg-yellow-300/5 grid place-items-center text-yellow-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_15px_rgba(253,224,71,0.1)]">
                <ShieldCheck size={26} className="animate-pulse" />
              </div>
            </div>

            <div className="text-right">
              <p className="text-[10px] text-slate-400">Certificate Hash ID</p>
              <p className="text-xs font-bold text-slate-200 mt-1 tracking-wider">{certData.certificate_id}</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
