import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

export default function SelectionGrid({ items, onSelect }) {
  return (
    <div className="grid grid-cols-2 gap-2 p-2.5 sm:gap-4 sm:p-5 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item, index) => (
        <motion.button
          key={item.id || item.name}
          type="button"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.015 }}
          onClick={() => onSelect(item)}
          className={`group relative min-h-[104px] overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br ${item.accent || 'from-cyan-300 to-blue-400'} p-[1px] text-left shadow-[0_7px_0_rgba(2,6,23,0.72),0_16px_30px_rgba(0,0,0,0.32)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_12px_0_rgba(2,6,23,0.72),0_24px_44px_rgba(0,0,0,0.36)] active:translate-y-1 active:shadow-[0_4px_0_rgba(2,6,23,0.72),0_10px_18px_rgba(0,0,0,0.28)] sm:min-h-[128px] sm:shadow-[0_12px_0_rgba(2,6,23,0.72),0_24px_42px_rgba(0,0,0,0.34)]`}
        >
          <div className="h-full rounded-[15px] bg-slate-950/76 p-2.5 backdrop-blur-xl sm:p-4">
            <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-white/60" />
            <div className="flex items-start justify-between gap-2 sm:gap-3">
              <div className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${item.accent || 'from-cyan-300 to-blue-400'} text-xs font-black text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_8px_18px_rgba(0,0,0,0.32)] sm:h-12 sm:w-12 sm:text-sm`}>
                {item.short || item.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/10 text-white shadow-[0_5px_0_rgba(2,6,23,0.55)] transition group-hover:translate-x-1 sm:h-9 sm:w-9">
                <ChevronRight size={17} />
              </div>
            </div>
            <div className="mt-2.5 sm:mt-4">
              <h3 className="line-clamp-2 text-sm font-black leading-5 text-white sm:text-base">{item.name}</h3>
              <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-300 sm:text-sm sm:leading-6">{item.description || 'Generate AI questions for this selection'}</p>
            </div>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
