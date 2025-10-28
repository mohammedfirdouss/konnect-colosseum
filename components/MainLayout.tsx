import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { HamburgerMenu } from './HamburgerMenu';
import { DesktopTopNav } from './DesktopTopNav';
import { Footer } from './Footer';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import { PWADebugInfo } from './PWADebugInfo';
import { useUser } from '../contexts/UserContext';
import { useIsMobile } from '../hooks/useIsMobile';

export function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated } = useUser();
  const { isMobile } = useIsMobile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Show loading state while user context is initializing
  // if (!isAuthenticated && user === null) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#121212' }}>
  //       <div className="text-center">
  //         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
  //         <p style={{ color: '#B3B3B3' }}>Loading...</p>
  //       </div>
  //     </div>
  //   );
  // }

  // Redirect to login if user is not authenticated
  // if (!isAuthenticated) {
  //   router.push('/');
  //   return null;
  // }

  // Map pathname to tab
  const getCurrentTab = () => {
    if (pathname.includes('/home')) return 'home';
    if (pathname.includes('/marketplace')) return 'marketplace';
    if (pathname.includes('/cart')) return 'cart';
    if (pathname.includes('/wallet')) return 'wallet';
    if (pathname.includes('/bills')) return 'bills';
    if (pathname.includes('/gamification')) return 'gamification';
    return 'home';
  };

  const handleTabChange = (tab: string) => {
    router.push(`/${tab}`);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#121212' }}>
      {/* Mobile Top Bar */}
      {isMobile && (
        <TopBar
          onMenuClick={() => setIsMenuOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          showMenuButton={isMobile}
        />
      )}

      {/* Desktop Top Navigation */}
      {!isMobile && (
        <DesktopTopNav
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      )}

      {/* Mobile Hamburger Menu */}
      {isMobile && user && (
        <HamburgerMenu
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          user={user}
        />
      )}

      {/* Main Content */}
      <div className={isMobile ? 'pt-16 pb-20' : 'pt-32'}>
        {children}
      </div>

      {/* Desktop Footer - Only shows on desktop */}
      {!isMobile && <Footer />}

      {/* Mobile Bottom Navigation */}
      {isMobile && user && (
        <BottomNav
          activeTab={getCurrentTab()}
          onTabChange={handleTabChange}
          userRole={user.role}
        />
      )}

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
      
      {/* Debug Info - Remove in production */}
      {/* <PWADebugInfo /> */}
    </div>
  );
}
