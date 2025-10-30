'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { WelcomeScreen } from '@/components/WelcomeScreen';
import { useUser } from '../contexts/UserContext';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, user, hasCompletedOnboarding } = useUser();

  // Debug logging
  console.log('Main page - user:', user);
  console.log('Main page - isAuthenticated:', isAuthenticated);
  console.log('Main page - hasCompletedOnboarding:', hasCompletedOnboarding);

  useEffect(() => {
    // If user is authenticated and has completed onboarding, redirect to home
    // if (isAuthenticated && hasCompletedOnboarding) {
    //   console.log('Redirecting to /home');
    //   router.push('/home');
    // }
  }, [isAuthenticated, hasCompletedOnboarding, router]);

  return <WelcomeScreen />;
}
