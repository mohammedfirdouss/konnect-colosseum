'use client';

import { UserProvider } from '../contexts/UserContext';
import { CartProvider } from '../contexts/CartContext';
import { SolanaWalletProvider } from '@/components/WalletProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SolanaWalletProvider>
        <UserProvider>
          <CartProvider>
            {children}
          </CartProvider>
        </UserProvider>
    </SolanaWalletProvider>
  );
}
