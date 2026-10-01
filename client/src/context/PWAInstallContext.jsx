import { createContext, useContext, useState, useEffect } from 'react';

const PWAInstallContext = createContext();

export function PWAInstallProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [canShowInstallHelp, setCanShowInstallHelp] = useState(false);
  const [hasInstallPrompt, setHasInstallPrompt] = useState(false);
  const [isIOSBrowser, setIsIOSBrowser] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    setIsInstalled(isStandalone);

    const dismissed = localStorage.getItem('placehub_install_dismissed') === 'true';
    setInstallDismissed(dismissed);

    // iOS Detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice =
      /iphone|ipad|ipod/.test(userAgent) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    
    setIsIOSBrowser(isIosDevice && !isStandalone);

    if (isStandalone) {
      return;
    }

    if (isIosDevice) {
      setCanShowInstallHelp(true);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setHasInstallPrompt(true);
      setCanShowInstallHelp(true);
    };

    const handleAppInstalled = () => {
      setCanShowInstallHelp(false);
      setHasInstallPrompt(false);
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome !== 'accepted') {
        setDeferredPrompt(null);
        setHasInstallPrompt(false);
      }
    } catch {
      setDeferredPrompt(null);
      setHasInstallPrompt(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('placehub_install_dismissed', 'true');
    setInstallDismissed(true);
  };

  const value = {
    canShowInstallHelp,
    hasInstallPrompt,
    isIOSBrowser,
    installDismissed,
    isInstalled,
    handleInstall,
    handleDismiss
  };

  return (
    <PWAInstallContext.Provider value={value}>
      {children}
    </PWAInstallContext.Provider>
  );
}

export function usePWAInstallContext() {
  const context = useContext(PWAInstallContext);
  if (!context) {
    throw new Error('usePWAInstallContext must be used within a PWAInstallProvider');
  }
  return context;
}
