import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

export default function SelectionGrid({ items, onSelect }) {
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item, index) => (
        <motion.button
          key={item.id || item.name}
          type="button"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.015 }}
          onClick={() => onSelect(item)}
          className={`group relative min-h-[128px] overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br ${item.accent || 'from-cyan-300 to-blue-400'} p-[1px] text-left shadow-[0_12px_0_rgba(2,6,23,0.72),0_24px_42px_rgba(0,0,0,0.34)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_16px_0_rgba(2,6,23,0.72),0_30px_54px_rgba(0,0,0,0.38)] active:translate-y-1 active:shadow-[0_6px_0_rgba(2,6,23,0.72),0_12px_22px_rgba(0,0,0,0.3)]`}
        >
          <div className="h-full rounded-[15px] bg-slate-950/78 p-4 backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/60" />
            <div className="flex items-start justify-between gap-3">
              <div className={`grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${item.accent || 'from-cyan-300 to-blue-400'} text-sm font-black text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_8px_18px_rgba(0,0,0,0.32)]`}>
                {item.short || item.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/10 text-white shadow-[0_6px_0_rgba(2,6,23,0.55)] transition group-hover:translate-x-1">
                <ChevronRight size={19} />
              </div>
            </div>
            <div className="mt-4">
              <h3 className="text-base font-black text-white">{item.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-300">{item.description || 'Generate AI questions for this selection'}</p>
            </div>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
