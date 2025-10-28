'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { X, Download, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    console.log('PWA Install Prompt: Initializing...');
    
    // Check if running on mobile
    const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(mobile);
    console.log('PWA Install Prompt: Is mobile?', mobile);

    // Check if running on iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);
    console.log('PWA Install Prompt: Is iOS?', iOS);

    // Check if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
    console.log('PWA Install Prompt: Is standalone?', standalone);

    // Check if user has already dismissed the prompt
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    console.log('PWA Install Prompt: Previously dismissed?', !!dismissed);

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('PWA Install Prompt: beforeinstallprompt event fired');
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show install prompt immediately for testing
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For testing purposes, show prompt on mobile even without beforeinstallprompt
    if (mobile && !standalone && !dismissed) {
      console.log('PWA Install Prompt: Showing prompt for mobile testing');
      setTimeout(() => {
        setShowInstallPrompt(true);
      }, 2000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    console.log('PWA Install Prompt: Install clicked');
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('PWA Install Prompt: User choice:', outcome);
        
        if (outcome === 'accepted') {
          console.log('PWA installed successfully');
        }
      } catch (error) {
        console.error('PWA Install Prompt: Error during installation:', error);
      }
      
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    } else {
      console.log('PWA Install Prompt: No deferred prompt available');
      // For iOS or when beforeinstallprompt is not available
      setShowInstallPrompt(false);
    }
  };

  const handleDismiss = () => {
    console.log('PWA Install Prompt: Dismissed');
    setShowInstallPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Debug logging
  useEffect(() => {
    console.log('PWA Install Prompt State:', {
      showInstallPrompt,
      isMobile,
      isIOS,
      isStandalone,
      hasDeferredPrompt: !!deferredPrompt
    });
  }, [showInstallPrompt, isMobile, isIOS, isStandalone, deferredPrompt]);

  // Don't show if already installed
  if (isStandalone) {
    console.log('PWA Install Prompt: Not showing - already in standalone mode');
    return null;
  }

  // Don't show if not mobile
  if (!isMobile) {
    console.log('PWA Install Prompt: Not showing - not mobile');
    return null;
  }

  if (!showInstallPrompt) {
    console.log('PWA Install Prompt: Not showing - prompt not triggered');
    return null;
  }

  console.log('PWA Install Prompt: Rendering prompt');

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <Card className="p-4 bg-[#1E1E1E] border-[#333333]">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#9945FF] flex items-center justify-center flex-shrink-0">
            <Smartphone size={20} className="text-white" />
          </div>
          
          <div className="flex-1">
            <h3 className="text-white font-medium text-sm mb-1">
              Install Konnect
            </h3>
            <p className="text-[#B3B3B3] text-xs mb-3">
              {isIOS 
                ? "Tap the share button and select 'Add to Home Screen' to install."
                : "Add to your home screen for quick access and a better experience."
              }
            </p>
            
            <div className="flex gap-2">
              {isIOS ? (
                <Button
                  onClick={handleDismiss}
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                >
                  Got it
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handleInstallClick}
                    size="sm"
                    className="flex-1 text-xs bg-[#9945FF] hover:bg-[#7F3DFF]"
                  >
                    <Download size={14} className="mr-1" />
                    Install
                  </Button>
                  <Button
                    onClick={handleDismiss}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    <X size={14} />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
