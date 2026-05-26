import { useEffect, useMemo, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export default function InstallButton() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const isAppleMobile = useMemo(() => {
    if (typeof navigator === 'undefined') {
      return false;
    }

    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }, []);

  useEffect(() => {
    setInstalled(isStandalone());

    const handleBeforeInstall = (event) => {
      event.preventDefault();
      setPromptEvent(event);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      setShowHelp(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  async function handleInstall() {
    if (installed) {
      return;
    }

    if (promptEvent) {
      promptEvent.prompt();
      await promptEvent.userChoice;
      setPromptEvent(null);
      return;
    }

    setShowHelp(true);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleInstall}
        title={installed ? 'App installed' : 'Install app'}
        className="group inline-flex h-11 w-11 items-center justify-center gap-1.5 rounded-xl border border-cyan-100/25 bg-gradient-to-br from-cyan-300 via-sky-400 to-violet-400 text-xs font-black text-slate-950 shadow-[0_7px_0_rgba(15,23,42,0.8),0_16px_30px_rgba(56,189,248,0.28)] transition duration-200 hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_3px_0_rgba(15,23,42,0.85),0_8px_18px_rgba(56,189,248,0.18)] sm:w-auto sm:px-4"
      >
        {installed ? <Smartphone size={16} /> : <Download size={16} className="animate-bounce-soft" />}
        <span className="hidden sm:inline">{installed ? 'Installed' : 'Install'}</span>
      </button>

      {showHelp ? (
        <div
          className="absolute right-0 top-12 z-[70] w-[min(82vw,300px)] rounded-2xl border border-cyan-100/25 bg-slate-950/95 p-4 text-left text-sm text-slate-100 shadow-[0_22px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
          role="dialog"
        >
          <button
            type="button"
            onClick={() => setShowHelp(false)}
            className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-300"
            title="Close install help"
          >
            <X size={15} />
          </button>
          <p className="pr-8 text-sm font-black text-cyan-100">Install on mobile</p>
          <p className="mt-2 text-xs leading-5 text-slate-300">
            {isAppleMobile
              ? 'Open Safari share menu, then tap Add to Home Screen.'
              : 'Open your browser menu and choose Install app or Add to Home screen.'}
          </p>
        </div>
      ) : null}
    </div>
  );
}
