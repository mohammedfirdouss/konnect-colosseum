'use client';

import { useRouter } from 'next/navigation';
import { RoleSelection } from '@/components/RoleSelection';
import { useUser, UserRole } from '../../contexts/UserContext';
import { useEffect } from 'react';

export default function RolePage() {
  const router = useRouter();
  const { user, setUser } = useUser();



  return <RoleSelection  />;
}
