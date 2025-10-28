'use client';

import { useRouter } from 'next/navigation';
import { NotificationSetup } from '@/components/NotificationSetup';
import { useUser } from '../../contexts/UserContext';
import { useEffect } from 'react';

export default function NotificationsPage() {
  const router = useRouter();
  const { user } = useUser();


  return <NotificationSetup  />;
}
