// PWA Installation & Silent Offline-Safe Service Worker Registration Hook
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    // Detect standalone mode (already installed or running in WebView / APK)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    // Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Register service worker in production; never force-reload mid-session on controllerchange
    if ('serviceWorker' in navigator) {
      if (import.meta.env.PROD) {
        const expectedSwUrl = new URL('./sw.js', window.location.href).href;
        navigator.serviceWorker
          .getRegistrations()
          .then((regs) => {
            regs.forEach((reg) => {
              const scriptUrl =
                reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL;
              if (scriptUrl && scriptUrl !== expectedSwUrl) {
                reg.unregister().catch(() => {});
              }
            });
          })
          .catch(() => {});

        navigator.serviceWorker
          .register('./sw.js', { updateViaCache: 'none' })
          .then((reg) => {
            if (reg.waiting) {
              setWaitingWorker(reg.waiting);
              setHasUpdate(true);
            }
            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing;
              if (!newWorker) return;
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setWaitingWorker(newWorker);
                  setHasUpdate(true);
                }
              });
            });
            // Check silently for updates only when online
            if (navigator.onLine !== false) {
              reg.update().catch(() => {});
            }
          })
          .catch((err) => {
            console.warn('SW register error:', err);
          });
      } else {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((reg) => reg.unregister());
        });
        if ('caches' in window) {
          caches.keys().then((names) => {
            names.forEach((name) => caches.delete(name));
          });
        }
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  const applyUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    }
    if (navigator.onLine !== false) {
      window.location.reload();
    }
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    hasUpdate,
    install,
    applyUpdate,
  };
}
