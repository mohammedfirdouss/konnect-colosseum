'use client';

import { FC, useMemo } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import {
  WalletModalProvider,
} from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
} from '@solana/wallet-adapter-phantom';
import {
  WalletConnectWalletAdapter,
} from '@solana/wallet-adapter-walletconnect';
import { clusterApiUrl } from '@solana/web3.js';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

import '@solana/wallet-adapter-react-ui/styles.css';

type Props = {
  readonly children: React.ReactNode;
};

export const SolanaWalletProvider: FC<Props> = ({ children }) => {
  // Use environment variable or fallback to devnet for development
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
  
  // Reliable RPC endpoints
  const endpoints = {
    devnet: 'https://api.devnet.solana.com',
    testnet: 'https://api.testnet.solana.com', 
    'mainnet-beta': 'https://api.mainnet-beta.solana.com'
  };
  
  const endpoint = endpoints[network as keyof typeof endpoints] || endpoints.devnet;
  
  console.log('Using Solana network:', network);
  console.log('Using Solana RPC endpoint:', endpoint);

  // ⚡ Use useMemo so adapters don’t get recreated on each render
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new WalletConnectWalletAdapter({
        network: WalletAdapterNetwork.Devnet,
        options: {
          relayUrl: 'wss://relay.walletconnect.com',
          projectId: 'bbc5ab1671dd12e85d521a520e0eb9c2', // get this below
        },
      }),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
