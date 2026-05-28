'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initializeAuthListener = useAuthStore((state) => state.initializeAuthListener);

  useEffect(() => {
    initializeAuthListener();

    // Register PWA service worker in production/active environments
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const handleLoad = () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('PWA Service Worker registered with scope:', registration.scope);
          })
          .catch((err) => {
            console.warn('PWA Service Worker registration failed:', err);
          });
      };

      if (document.readyState === 'complete') {
        handleLoad();
      } else {
        window.addEventListener('load', handleLoad);
        return () => window.removeEventListener('load', handleLoad);
      }
    }
  }, [initializeAuthListener]);

  return (
    <html lang="en">
      <head>
        <title>AI Question Bank - Futuristic Learning Platform</title>
        <meta name="description" content="Cinematic AI-Powered Question Bank & Mock Test platform for ICSE, CBSE, and Competitive Exams." />
        
        {/* PWA Meta Tags */}
        <meta name="theme-color" content="#050816" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Question Bank" />
        <link rel="apple-touch-icon" href="/pwa-icon-192x192.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        <div className="relative min-h-screen w-full overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}
