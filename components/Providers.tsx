'use client';

import { UserProvider } from '../contexts/UserContext';
import { CartProvider } from '../contexts/CartContext';
import { SolanaWalletProvider } from '@/components/WalletProvider';
import { Toaster } from '@/components/ui/sonner';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SolanaWalletProvider>
        <UserProvider>
          <CartProvider>
            {children}
            <Toaster position="top-center" />
          </CartProvider>
        </UserProvider>
      </SolanaWalletProvider>
    </QueryClientProvider>
  );
}
