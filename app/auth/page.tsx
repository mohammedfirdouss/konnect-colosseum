'use client';

import { useRouter } from 'next/navigation';
import { AuthScreen } from '@/components/AuthScreen';
import { useUser } from '../../contexts/UserContext';

export default function AuthPage() {
  const router = useRouter();
  const { setUser } = useUser();

 

  return <AuthScreen  />;
}
