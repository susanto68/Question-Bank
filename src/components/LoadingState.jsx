import { motion } from 'framer-motion';

export default function LoadingState({ label = 'Generating 100 questions' }) {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: 'easeOut' }}>
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-cyan-200/20 bg-cyan-200/10">
          <motion.div
            className="h-12 w-12 rounded-full border-4 border-cyan-200 border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
          />
        </div>
        <h3 className="mt-6 text-xl font-black">{label}</h3>
        <motion.p
          className="mt-3 max-w-sm text-base font-black leading-7 text-cyan-100 sm:text-lg"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.18, duration: 0.5, ease: 'easeOut' }}
        >
          Please wait for 2 minutes
        </motion.p>
      </motion.div>
    </div>
  );
}
