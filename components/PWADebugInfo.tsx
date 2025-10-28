'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';

export function PWADebugInfo() {
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    const info = {
      userAgent: navigator.userAgent,
      isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
      isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
      isStandalone: window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true,
      hasServiceWorker: 'serviceWorker' in navigator,
      hasManifest: document.querySelector('link[rel="manifest"]') !== null,
      localStorage: typeof Storage !== 'undefined',
      dismissed: localStorage.getItem('pwa-install-dismissed'),
    };
    
    setDebugInfo(info);
  }, []);

  const clearDismissed = () => {
    localStorage.removeItem('pwa-install-dismissed');
    setDebugInfo(prev => ({ ...prev, dismissed: null }));
  };

  return (
    <Card className="p-4 m-4 bg-[#1E1E1E] border-[#333333]">
      <h3 className="text-white font-medium mb-3">PWA Debug Info</h3>
      <div className="space-y-2 text-xs">
        <div><strong>Mobile:</strong> {debugInfo.isMobile ? 'Yes' : 'No'}</div>
        <div><strong>iOS:</strong> {debugInfo.isIOS ? 'Yes' : 'No'}</div>
        <div><strong>Standalone:</strong> {debugInfo.isStandalone ? 'Yes' : 'No'}</div>
        <div><strong>Service Worker:</strong> {debugInfo.hasServiceWorker ? 'Yes' : 'No'}</div>
        <div><strong>Manifest:</strong> {debugInfo.hasManifest ? 'Yes' : 'No'}</div>
        <div><strong>Dismissed:</strong> {debugInfo.dismissed ? 'Yes' : 'No'}</div>
        <div><strong>User Agent:</strong> {debugInfo.userAgent}</div>
      </div>
      <Button 
        onClick={clearDismissed} 
        size="sm" 
        className="mt-3 text-xs"
        variant="outline"
      >
        Clear Dismissed
      </Button>
    </Card>
  );
}
