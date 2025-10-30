'use client';

import { useSearchParams } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';
import { useMarketplace } from '@/hooks/useMarketplace';
import { useWallet } from '@solana/wallet-adapter-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import SellerListings from '@/components/SellerListings';
import MarketplaceProducts from '@/components/MarketplaceProducts';

export default function MarketplacePage() {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  console.log("user", user?.role);
  const isSeller = user?.role === "seller" || user?.role === "both";

  // console.log('isSeller', isSeller);
  console.log("user", user);

  const { initMarketplace, loading, getMarketplaceAddress } = useMarketplace();
  const { connected, publicKey } = useWallet();
  const [isInitialized, setIsInitialized] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);


  const handleInitMarketplace = async () => {
    try {
      console.log('Starting marketplace initialization...');
      toast.loading('Initializing marketplace...', { id: 'init-marketplace' });
      
      // Initialize with 2% fee (200 basis points)
      const tx = await initMarketplace(200);
      
      if (tx) {
        console.log('Marketplace initialized successfully:', tx);
        setIsInitialized(true);
        
        // Show success message
        toast.success('🎉 Marketplace initialized successfully!', { 
          id: 'init-marketplace',
          description: `Transaction: ${tx.slice(0, 8)}...${tx.slice(-8)}`
        });
        
        // Refresh data after initialization to get updated stats
        // setTimeout(() => {
        //   refreshData();
        // }, 1000);
      } else if (tx === 'already-initialized') {
        console.log('Marketplace was already initialized');
        setIsInitialized(true);
        toast.success('Marketplace was already initialized!', { id: 'init-marketplace' });
      }
    } catch (error: any) {
      console.error('Failed to initialize marketplace:', error);
      
      // Show user-friendly error message
      if (error.message?.includes('User rejected')) {
        toast.error('Transaction cancelled by user', { id: 'init-marketplace' });
      } else if (error.message?.includes('insufficient funds')) {
        toast.error('Insufficient SOL balance for transaction fees', { id: 'init-marketplace' });
      } else if (error.message?.includes('already initialized')) {
        toast.success('Marketplace was already initialized!', { id: 'init-marketplace' });
        setIsInitialized(true);
      } else {
        toast.error(`Transaction failed: ${error.message}`, { id: 'init-marketplace' });
      }
    }
  };

  
  // Get marketplace address
  const marketplaceAddress = connected && publicKey ? getMarketplaceAddress(publicKey) : null;

  // Check if marketplace is initialized based on data
  // useEffect(() => {
  //   if (marketplaceInfo) {
  //     setIsInitialized(true);
  //   }
  // }, [marketplaceInfo]);

  return (
    <div>
      {/* Marketplace Status Banner */}

      {/* Wallet Connection Prompt */}
      {!connected && (
        <div className="p-4 bg-[#1E1E1E] border-b border-[#333333]">
          <div className="max-w-7xl mx-auto">
            <Card className="p-6 bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/20">
              <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-center md:text-left">
                <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-xl">🔗</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-lg mb-1">
                    Connect Your Wallet
                  </h3>
                  <p className="text-[#B3B3B3] text-sm">
                    Connect your Solana wallet to initialize and manage your
                    marketplace
                  </p>
                </div>
                <div className="text-sm text-[#666666]">
                  <p>Required for:</p>
                  <p>• Marketplace initialization</p>
                  <p>• Transaction management</p>
                  <p>• Data access</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Data Error Display */}
      {/* {dataError && (
        <div className="p-4 bg-[#1E1E1E] border-b border-[#333333]">
          <div className="max-w-7xl mx-auto">
            <Card className="p-4 bg-red-900/20 border-red-500/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">!</span>
                </div>
                <div className="flex-1">
                  <h4 className="text-red-400 font-medium">Error Loading Marketplace Data</h4>
                  <p className="text-red-300 text-sm mt-1">{dataError}</p>
                </div>
                <Button
                  onClick={refreshData}
                  variant="outline"
                  size="sm"
                  className="border-red-500 text-red-400 hover:bg-red-500 hover:text-white"
                >
                  Retry
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )} */}

      {/* Debug Info - Remove in production */}
      {/* {process.env.NODE_ENV === 'development' && (
        <div className="p-4 bg-blue-900/20 border-b border-blue-700">
          <div className="max-w-7xl mx-auto">
            <h3 className="text-blue-400 text-sm font-medium mb-2">Debug Info:</h3>
            <div className="text-blue-300 text-xs space-y-1">
              <p>Listings: {listings.length}</p>
              <p>Merchants: {merchants.length}</p>
              <p>Marketplace: {marketplaceInfo ? 'Initialized' : 'Not initialized'}</p>
              <p>Loading: {dataLoading ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </div>
      )} */}

      {isSeller ? <SellerListings /> : <MarketplaceProducts />}
    </div>
  );
}
