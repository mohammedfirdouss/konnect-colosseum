import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import "@solana/wallet-adapter-react-ui/styles.css";
import { Providers } from '@/components/Providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Konnect - Campus Economy Hub',
  description: 'Buy, sell, and manage your campus economy with Konnect',
  manifest: '/manifest.json',
  themeColor: '#9945FF',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Konnect',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}