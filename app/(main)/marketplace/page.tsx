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
  
  const isSeller = user?.role === 'seller' || user?.role === 'both';

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
      {connected && (
        <div className="p-4 bg-[#1E1E1E] border-b border-[#333333]">
          <div className="max-w-7xl mx-auto">
            {!isInitialized ? (
              <Card className="p-6 bg-gradient-to-r from-[#9945FF]/10 to-[#7F3DFF]/10 border-[#9945FF]/20">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-[#9945FF] flex items-center justify-center">
                        <span className="text-white font-bold text-lg">K</span>
                      </div>
                      <div>
                        <h2 className="text-white font-semibold text-lg">Initialize Your Marketplace</h2>
                        <p className="text-[#B3B3B3] text-sm">
                          Set up your decentralized marketplace with a 2% transaction fee
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2 text-sm text-[#B3B3B3]">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>2% transaction fee</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#B3B3B3]">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span>Decentralized and secure</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-[#B3B3B3]">
                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                        <span>Built on Solana blockchain</span>
                      </div>
                      {marketplaceAddress && (
                        <div className="mt-3 p-3 bg-[#121212] rounded-lg border border-[#333333]">
                          <p className="text-xs text-[#666666] mb-1">Marketplace Address:</p>
                          <p className="text-sm text-[#9945FF] break-all font-mono">{marketplaceAddress.toString()}</p>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(marketplaceAddress.toString());
                              toast.success('Address copied to clipboard!');
                            }}
                            className="mt-2 text-xs text-[#9945FF] hover:text-[#7F3DFF] underline"
                          >
                            Copy Address
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                  <Button
                          disabled={loading}
                          onClick={handleInitMarketplace}
                          className="bg-[#9945FF] hover:bg-[#7F3DFF] text-white font-medium px-6 py-3 min-w-[140px]"
                        >
                          {loading ? (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Initializing...
                            </div>
                          ) : (
                            'Initialize Marketplace'
                          )}
                        </Button>
                    {/* <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                      <DialogTrigger asChild>
                        <Button
                          disabled={loading}
                          onClick={handleInitMarketplace}
                          className="bg-[#9945FF] hover:bg-[#7F3DFF] text-white font-medium px-6 py-3 min-w-[140px]"
                        >
                          {loading ? (
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Initializing...
                            </div>
                          ) : (
                            'Initialize Marketplace'
                          )}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-[#1E1E1E] border-[#333333] text-white">
                        <DialogHeader>
                          <DialogTitle className="text-white">Initialize Marketplace</DialogTitle>
                          <DialogDescription className="text-[#B3B3B3]">
                            This will create your decentralized marketplace on the Solana blockchain with a 2% transaction fee.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-3">
                          <div className="flex items-center gap-3 p-3 bg-[#121212] rounded-lg">
                            <div className="w-8 h-8 rounded-full bg-[#9945FF] flex items-center justify-center">
                              <span className="text-white font-bold text-sm">2%</span>
                            </div>
                            <div>
                              <p className="text-white font-medium">Transaction Fee</p>
                              <p className="text-[#B3B3B3] text-sm">2% fee on all transactions</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-3 bg-[#121212] rounded-lg">
                            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                              <span className="text-white font-bold text-sm">✓</span>
                            </div>
                            <div>
                              <p className="text-white font-medium">One-time Setup</p>
                              <p className="text-[#B3B3B3] text-sm">No recurring fees or subscriptions</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-3 bg-[#121212] rounded-lg">
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                              <span className="text-white font-bold text-sm">🔒</span>
                            </div>
                            <div>
                              <p className="text-white font-medium">Decentralized</p>
                              <p className="text-[#B3B3B3] text-sm">Built on Solana blockchain</p>
                            </div>
                          </div>
                        </div>
                        <DialogFooter className="gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setShowConfirmDialog(false)}
                            className="border-[#333333] text-[#B3B3B3] hover:bg-[#333333]"
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={() => {
                              setShowConfirmDialog(false);
                              handleInitMarketplace();
                            }}
                            className="bg-[#9945FF] hover:bg-[#7F3DFF] text-white"
                          >
                            Confirm & Initialize
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog> */}
                    <p className="text-xs text-[#666666] text-center">
                      One-time setup • No recurring fees
                    </p>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-6 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">✓</span>
                      </div>
                      <div>
                        <h2 className="text-white font-semibold text-lg">Marketplace Active</h2>
                        <p className="text-[#B3B3B3] text-sm">
                          Your marketplace is live and ready for transactions
                        </p>
                      </div>
                    </div>
                    {/* <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-[#121212] rounded-lg p-3">
                        <div className="text-2xl font-bold text-white">{listings.length}</div>
                        <div className="text-sm text-[#B3B3B3]">Active Listings</div>
                      </div>
                      <div className="bg-[#121212] rounded-lg p-3">
                        <div className="text-2xl font-bold text-white">{merchants.length}</div>
                        <div className="text-sm text-[#B3B3B3]">Registered Merchants</div>
                      </div>
                      <div className="bg-[#121212] rounded-lg p-3">
                        <div className="text-2xl font-bold text-white">{marketplaceInfo?.feeBps || 0}</div>
                        <div className="text-sm text-[#B3B3B3]">Fee (basis points)</div>
                      </div>
                    </div> */}
                  </div>
                  {/* <div className="flex flex-col gap-2">
                    <Button
                      onClick={refreshData}
                      disabled={dataLoading}
                      variant="outline"
                      className="border-[#9945FF] text-[#9945FF] hover:bg-[#9945FF] hover:text-white px-6 py-3 min-w-[120px]"
                    >
                      {dataLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-[#9945FF] border-t-transparent rounded-full animate-spin"></div>
                          Refreshing...
                        </div>
                      ) : (
                        'Refresh Data'
                      )}
                    </Button>
                    <p className="text-xs text-[#666666] text-center">
                      Last updated: {new Date().toLocaleTimeString()}
                    </p>
                  </div> */}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

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
                  <h3 className="text-white font-semibold text-lg mb-1">Connect Your Wallet</h3>
                  <p className="text-[#B3B3B3] text-sm">
                    Connect your Solana wallet to initialize and manage your marketplace
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


{isSeller ? <SellerListings/> :  <MarketplaceProducts />}

    </div>
  );
}
