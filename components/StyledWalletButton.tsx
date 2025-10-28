'use client';

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';

export function StyledWalletButton() {
  const { connected, wallet, publicKey } = useWallet();
  
  return (
    <div className={`wallet-button-wrapper ${connected ? 'connected' : 'disconnected'}`} >
                  <WalletMultiButton/>

    </div>
  );
}