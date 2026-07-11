'use client';

import { Eye } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const visitorSessionKey = 'question-bank-visitor-counted';

function formatCount(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(value);
}

export default function VisitorCounter() {
  const pathname = usePathname() || '/';
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    async function syncVisitorCount() {
      const counted = window.sessionStorage.getItem(visitorSessionKey) === '1';
      const response = await fetch('/api/visitors', {
        method: counted ? 'GET' : 'POST',
        headers: counted ? undefined : { 'Content-Type': 'application/json' },
        body: counted ? undefined : JSON.stringify({ path: pathname }),
      });
      const data = await response.json();

      if (!counted && data.ok) {
        window.sessionStorage.setItem(visitorSessionKey, '1');
      }

      if (mounted && typeof data.count === 'number') {
        setCount(data.count);
      }
    }

    syncVisitorCount().catch(() => {
      if (mounted) setCount(null);
    });

    return () => {
      mounted = false;
    };
  }, [pathname]);

  return (
    <div
      title="Total visitors"
      className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-gradient-to-br from-fuchsia-300/20 via-cyan-300/15 to-emerald-300/15 px-2.5 text-[11px] font-black text-cyan-50 shadow-[0_6px_0_rgba(2,6,23,0.62),0_13px_24px_rgba(34,211,238,0.16)] sm:px-3 sm:text-xs"
    >
      <Eye size={16} className="text-cyan-200" />
      <span>{count === null ? '--' : formatCount(count)}</span>
    </div>
  );
}
