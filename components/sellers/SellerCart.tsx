import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package, Truck, CheckCircle, Eye, Calendar, User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUser } from '@/contexts/UserContext';
import { useCart } from '@/contexts/CartContext';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/useIsMobile';
import { PendingOrder } from '@/interfaces';
import { useMarketplace } from '@/hooks/useMarketplace';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

const SellerCart = () => {

    const { user, setUser } = useUser();
    const { clearCart, getCartTotal } = useCart();
    const { isMobile } = useIsMobile();
    const { connected, publicKey } = useWallet();
    const { 
      releaseServiceOrder, 
      getMarketplaceAddress, 
      allListings, 
      loading: marketplaceLoading 
    } = useMarketplace();
  
    const [activeTab, setActiveTab] = useState('pending');
    const [deliveryCodeDialog, setDeliveryCodeDialog] = useState(false);
    const [deliveryCode, setDeliveryCode] = useState('');
 

    const [orderDetailsDialog, setOrderDetailsDialog] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<PendingOrder | null>(null);
    

  
    // Mock pending orders for sellers
    const pendingOrders: PendingOrder[] = [
      {
        id: 1,
        name: 'iPhone 13 Pro',
        price: 450000,
        buyer: 'Alice W.',
        buyerPhone: '+234 801 234 5678',
        deliveryAddress: '123 University Road, Yaba Campus',
        orderDate: '2025-10-22',
        image: 'https://images.unsplash.com/photo-1564572234453-6b14f6e6fcfb?w=400'
      },
      {
        id: 2,
        name: 'MacBook Air M2',
        price: 850000,
        buyer: 'John D.',
        buyerPhone: '+234 802 345 6789',
        deliveryAddress: '45 Student Plaza, Ikeja Campus',
        orderDate: '2025-10-22'
      }
    ];
  
    // Mock ongoing and completed orders
    const ongoingOrders: PendingOrder[] = [
      { 
        id: 1, 
        name: 'Campus Hoodie', 
        price: 12500, 
        seller: 'David K.', 
        status: 'In Transit', 
        deliveryCode: '8453', 
        buyer: 'Sarah M.',
        acceptedDate: '2025-10-21',
        type: 'good' as const
      },
      { 
        id: 2, 
        name: 'Logo Design Service', 
        price: 25000, 
        seller: 'Creative Studio', 
        status: 'In Progress', 
        buyer: 'Tech Startup',
        acceptedDate: '2025-10-23',
        type: 'service' as const
      },
    ];
  
    const completedOrders = [
      { 
        id: 1, 
        name: 'Textbooks Bundle', 
        price: 15000, 
        seller: 'Emma L.', 
        date: '2025-10-10', 
        buyer: 'Bob S.', 
        rated: false,
        revenue: 14700 // After fees
      },
    ];
  
    const calculateFees = (subtotal: number) => {
      return Math.round(subtotal * 0.02); // 2% platform fee
    };

  
    const handleFinalizeOrder = () => {
      // In a real app, this would process the payment and create the order
      toast.success('Order placed successfully! Funds are in escrow.', {
        duration: 3000,
      });
      
      // Update gamification points
      if (user) {
        const pointsEarned = 10; // Points for placing order
        setUser({
          ...user,
          gamificationPoints: (user.gamificationPoints || 0) + pointsEarned
        });
        
        setTimeout(() => {
          toast.success(`+${pointsEarned} points earned!`, {
            duration: 2000,
          });
        }, 1000);
      }
      
      clearCart();

    };
  
    const handleViewOrderDetails = (order: PendingOrder) => {
      setSelectedOrder(order);
      setOrderDetailsDialog(true);
    };

    const handleCompleteServiceOrder = async (order: PendingOrder) => {
      if (!connected || !publicKey) {
        toast.error('Please connect your wallet to complete the service order');
        return;
      }

      try {
        toast.loading('Completing service order...', { id: 'complete-service' });
        
        // Get marketplace address
        const marketplaceAddress = getMarketplaceAddress(publicKey) || 
          new PublicKey("44aN6AM28H9LjBSLR833rg8FV6UFQ7XCuPC5vP87EQ76");
        
        // Find the corresponding blockchain listing
        const blockchainListing = allListings.find(
          (listing: any) => listing.address === order.id || listing.id === order.id
        );
        
        if (blockchainListing) {
          const listingPubkey = new PublicKey(blockchainListing.address);
          const buyerPubkey = new PublicKey(blockchainListing.seller); // This should be the buyer's address
          
          // Derive escrow PDA
          const [escrow] = PublicKey.findProgramAddressSync(
            [Buffer.from('escrow'), listingPubkey.toBuffer(), buyerPubkey.toBuffer()],
            new PublicKey("B5nTWLtcbWiMpG26vTMBdVMZw3DL2ewsXZid1SDGBZNa") // Program ID
          );
          
          // Derive vault PDA
          const mintAddress = new PublicKey("So11111111111111111111111111111111111111112");
          const [vault] = PublicKey.findProgramAddressSync(
            [escrow.toBuffer(), Buffer.from('vault'), mintAddress.toBuffer()],
            new PublicKey("B5nTWLtcbWiMpG26vTMBdVMZw3DL2ewsXZid1SDGBZNa")
          );
          
          // Get proper Associated Token Accounts
          const sellerAta = getAssociatedTokenAddressSync(
            mintAddress,
            publicKey,
            false
          );
          const treasuryAta = getAssociatedTokenAddressSync(
            mintAddress,
            marketplaceAddress,
            false
          );
          
          await releaseServiceOrder(
            escrow,
            marketplaceAddress,
            listingPubkey,
            sellerAta,
            treasuryAta,
            vault
          );
          
          toast.success('Service order completed! Funds released.', { id: 'complete-service' });
          
          // Update gamification points
          if (user) {
            const pointsEarned = 20; // Points for completing service
            setUser({
              ...user,
              gamificationPoints: (user.gamificationPoints || 0) + pointsEarned
            });
            
            setTimeout(() => {
              toast.success(`+${pointsEarned} points earned!`, {
                duration: 2000,
              });
            }, 1000);
          }
          
        } else {
          // For mock orders, just show success
          toast.success('Service order completed!', { id: 'complete-service' });
        }
        
      } catch (error: any) {
        console.error('Failed to complete service order:', error);
        toast.error(`Failed to complete service order: ${error.message}`, { id: 'complete-service' });
      }
    };
  
    const handleAcceptOrder = (orderId: number) => {
      toast.success('Order accepted! Moving to ongoing orders...', {
        duration: 2000,
      });
      
      // Update gamification points
      if (user) {
        const pointsEarned = 15; // Points for accepting order
        setUser({
          ...user,
          gamificationPoints: (user.gamificationPoints || 0) + pointsEarned
        });
        
        setTimeout(() => {
          toast.success(`+${pointsEarned} points earned!`, {
            duration: 2000,
          });
        }, 1000);
      }
      
      setOrderDetailsDialog(false);
      setActiveTab('ongoing');
    };
  
    const handleConfirmDelivery = () => {
      if (deliveryCode.trim().length < 4) {
        toast.error('Please enter a valid delivery code');
        return;
      }
  
      toast.success('Delivery confirmed! Escrow funds released.', {
        duration: 3000,
      });
      
      // Update gamification points
      if (user) {
        const pointsEarned = 25; // Points for completing delivery
        setUser({
          ...user,
          gamificationPoints: (user.gamificationPoints || 0) + pointsEarned
        });
        
        setTimeout(() => {
          toast.success(`+${pointsEarned} points earned!`, {
            duration: 2000,
          });
        }, 1500);
      }
      
      setDeliveryCodeDialog(false);
      setDeliveryCode('');
      setActiveTab('completed');
    };
  
    const subtotal = getCartTotal();
    const fees = calculateFees(subtotal);
    const total = subtotal + fees;
  
  return (
    <div className={isMobile ? 'px-4 py-6 space-y-6' : 'max-w-7xl mx-auto px-8 py-8 space-y-6'}>
    <h2 style={{ color: '#FFFFFF' }}>My Orders</h2>

    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className={isMobile ? 'w-full grid grid-cols-3' : 'inline-flex'} style={{ backgroundColor: '#1E1E1E' }}>
        <TabsTrigger 
          value="pending" 
          style={{ 
            color: activeTab === 'pending' ? '#FFFFFF' : '#B3B3B3',
            backgroundColor: activeTab === 'pending' ? '#9945FF' : 'transparent',
          }}
        >
          Pending ({pendingOrders.length})
        </TabsTrigger>
        <TabsTrigger 
          value="ongoing" 
          style={{ 
            color: activeTab === 'ongoing' ? '#FFFFFF' : '#B3B3B3',
            backgroundColor: activeTab === 'ongoing' ? '#9945FF' : 'transparent',
          }}
        >
          Ongoing ({ongoingOrders.length})
        </TabsTrigger>
        <TabsTrigger 
          value="completed" 
          style={{ 
            color: activeTab === 'completed' ? '#FFFFFF' : '#B3B3B3',
            backgroundColor: activeTab === 'completed' ? '#9945FF' : 'transparent',
          }}
        >
          Completed
        </TabsTrigger>
      </TabsList>

      {/* Pending Orders */}
      <TabsContent value="pending" className={isMobile ? 'space-y-3 mt-4' : 'grid grid-cols-2 lg:grid-cols-3 gap-4 mt-6'}>
        {pendingOrders.length === 0 ? (
          <Card className="p-8 text-center" style={{ backgroundColor: '#1E1E1E', borderColor: '#333333' }}>
            <Package size={48} className="mx-auto mb-4" style={{ color: '#666666' }} />
            <p style={{ color: '#B3B3B3' }}>No pending orders</p>
          </Card>
        ) : (
          pendingOrders.map((order) => (
            <Card key={order.id} className="p-4" style={{ backgroundColor: '#1E1E1E', borderColor: '#333333' }}>
              <div className="flex gap-3">
                <div className="w-20 h-20 rounded-lg" style={{ backgroundColor: '#333333' }}>
                  {order.image ? (
                    <ImageWithFallback src={order.image} alt={order.name} className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <Package size={40} className="mx-auto mt-4" style={{ color: '#666666' }} />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="mb-1" style={{ color: '#FFFFFF' }}>{order.name}</h3>
                  <p className="text-sm" style={{ color: '#B3B3B3' }}>Buyer: {order.buyer}</p>
                  <p className="mt-2" style={{ color: '#9945FF' }}>₦{order.price.toLocaleString()}</p>
                  <div className="flex gap-2 mt-3">
                    <Button
                      className="flex-1"
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewOrderDetails(order)}
                      style={{ borderColor: '#9945FF', color: '#9945FF' }}
                    >
                      <Eye size={16} className="mr-1" />
                      View
                    </Button>
                    <Button
                      className="flex-1"
                      size="sm"
                      onClick={() => handleAcceptOrder(order.id)}
                      style={{ backgroundColor: '#9945FF', color: '#FFFFFF' }}
                    >
                      Accept
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </TabsContent>

      {/* Ongoing Orders */}
      <TabsContent value="ongoing" className={isMobile ? 'space-y-3 mt-4' : 'grid grid-cols-2 lg:grid-cols-3 gap-4 mt-6'}>
        {ongoingOrders.length === 0 ? (
          <Card className="p-8 text-center" style={{ backgroundColor: '#1E1E1E', borderColor: '#333333' }}>
            <Truck size={48} className="mx-auto mb-4" style={{ color: '#666666' }} />
            <p style={{ color: '#B3B3B3' }}>No ongoing orders</p>
          </Card>
        ) : (
          ongoingOrders.map((order) => (
            <Card key={order.id} className="p-4" style={{ backgroundColor: '#1E1E1E', borderColor: '#333333' }}>
              <div className="flex gap-3">
                <div className="w-20 h-20 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#333333' }}>
                  <Truck size={32} style={{ color: '#9945FF' }} />
                </div>
                <div className="flex-1">
                  <h3 className="mb-1" style={{ color: '#FFFFFF' }}>{order.name}</h3>
                  <p className="text-sm" style={{ color: '#B3B3B3' }}>Buyer: {order.buyer}</p>
                  <div className="mt-2 px-2 py-1 rounded inline-block text-xs" style={{ backgroundColor: '#FFBF00', color: '#121212' }}>
                    {order.status}
                  </div>
                  {order.type === 'good' && order.deliveryCode && (
                    <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: '#121212' }}>
                      <p className="text-sm mb-1" style={{ color: '#B3B3B3' }}>Buyer's Delivery Code:</p>
                      <p className="text-xl" style={{ color: '#9945FF' }}>{order.deliveryCode}</p>
                    </div>
                  )}
                  
                  {order.type === 'service' ? (
                    <Button
                      className="w-full mt-3"
                      size="sm"
                      onClick={() => handleCompleteServiceOrder(order)}
                      style={{ backgroundColor: '#4AFF99', color: '#121212' }}
                      disabled={!connected || marketplaceLoading}
                    >
                      {marketplaceLoading ? 'Processing...' : 'Complete Service & Release Funds'}
                    </Button>
                  ) : (
                    <Button
                      className="w-full mt-3"
                      size="sm"
                      onClick={() => setDeliveryCodeDialog(true)}
                      style={{ backgroundColor: '#9945FF', color: '#FFFFFF' }}
                    >
                      Confirm Delivery
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </TabsContent>

      {/* Completed Orders */}
      <TabsContent value="completed" className={isMobile ? 'space-y-3 mt-4' : 'grid grid-cols-2 lg:grid-cols-3 gap-4 mt-6'}>
        {completedOrders.length === 0 ? (
          <Card className="p-8 text-center" style={{ backgroundColor: '#1E1E1E', borderColor: '#333333' }}>
            <CheckCircle size={48} className="mx-auto mb-4" style={{ color: '#666666' }} />
            <p style={{ color: '#B3B3B3' }}>No completed orders</p>
          </Card>
        ) : (
          completedOrders.map((order) => (
            <Card key={order.id} className="p-4" style={{ backgroundColor: '#1E1E1E', borderColor: '#333333' }}>
              <div className="flex gap-3">
                <div className="w-20 h-20 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#4AFF99' }}>
                  <CheckCircle size={32} style={{ color: '#121212' }} />
                </div>
                <div className="flex-1">
                  <h3 className="mb-1" style={{ color: '#FFFFFF' }}>{order.name}</h3>
                  <p className="text-sm" style={{ color: '#B3B3B3' }}>Buyer: {order.buyer}</p>
                  <p className="text-sm" style={{ color: '#B3B3B3' }}>Completed: {order.date}</p>
                  <div className="mt-2">
                    <p className="text-xs" style={{ color: '#666666' }}>Revenue (after fees):</p>
                    <p style={{ color: '#4AFF99' }}>₦{order.revenue.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </TabsContent>
    </Tabs>

    {/* Order Details Dialog */}
    <Dialog open={orderDetailsDialog} onOpenChange={setOrderDetailsDialog}>
      <DialogContent style={{ backgroundColor: '#1E1E1E', borderColor: '#333333' }}>
        <DialogHeader>
          <DialogTitle style={{ color: '#FFFFFF' }}>Order Details</DialogTitle>
        </DialogHeader>
        {selectedOrder && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-24 h-24 rounded-lg" style={{ backgroundColor: '#333333' }}>
                {selectedOrder.image ? (
                  <ImageWithFallback 
                    src={selectedOrder.image} 
                    alt={selectedOrder.name} 
                    className="w-full h-full object-cover rounded-lg" 
                  />
                ) : (
                  <Package size={48} className="mx-auto mt-4" style={{ color: '#666666' }} />
                )}
              </div>
              <div className="flex-1">
                <h3 style={{ color: '#FFFFFF' }}>{selectedOrder.name}</h3>
                <p className="mt-2 text-xl" style={{ color: '#9945FF' }}>
                  ₦{selectedOrder.price.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-lg" style={{ backgroundColor: '#121212' }}>
                <div className="flex items-center gap-2 mb-2">
                  <User size={16} style={{ color: '#9945FF' }} />
                  <p className="text-sm" style={{ color: '#B3B3B3' }}>Buyer Information</p>
                </div>
                <p style={{ color: '#FFFFFF' }}>{selectedOrder.buyer}</p>
                <p className="text-sm mt-1" style={{ color: '#B3B3B3' }}>{selectedOrder.buyerPhone}</p>
              </div>

              <div className="p-3 rounded-lg" style={{ backgroundColor: '#121212' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Package size={16} style={{ color: '#9945FF' }} />
                  <p className="text-sm" style={{ color: '#B3B3B3' }}>Delivery Address</p>
                </div>
                <p style={{ color: '#FFFFFF' }}>{selectedOrder.deliveryAddress}</p>
              </div>

              <div className="p-3 rounded-lg" style={{ backgroundColor: '#121212' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={16} style={{ color: '#9945FF' }} />
                  <p className="text-sm" style={{ color: '#B3B3B3' }}>Order Date</p>
                </div>
                <p style={{ color: '#FFFFFF' }}>{selectedOrder.orderDate}</p>
              </div>
            </div>

            <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(153, 69, 255, 0.1)', borderLeft: '3px solid #9945FF' }}>
              <p className="text-sm" style={{ color: '#B3B3B3' }}>
                Funds are in escrow. Accept this order to begin delivery process.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setOrderDetailsDialog(false)}
                style={{ borderColor: '#333333', color: '#B3B3B3' }}
              >
                Close
              </Button>
              <Button
                className="flex-1"
                onClick={() => selectedOrder && handleAcceptOrder(selectedOrder.id)}
                style={{ backgroundColor: '#9945FF', color: '#FFFFFF' }}
              >
                Accept Order
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Delivery Code Dialog for Sellers */}
    <Dialog open={deliveryCodeDialog} onOpenChange={setDeliveryCodeDialog}>
      <DialogContent style={{ backgroundColor: '#1E1E1E', borderColor: '#333333' }}>
        <DialogHeader>
          <DialogTitle style={{ color: '#FFFFFF' }}>Confirm Delivery</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p style={{ color: '#B3B3B3' }}>
            Enter the buyer's delivery code to release escrow funds
          </p>
          <div>
            <Label style={{ color: '#B3B3B3' }}>Delivery Code</Label>
            <Input
              value={deliveryCode}
              onChange={(e) => setDeliveryCode(e.target.value)}
              placeholder="Enter 4-digit code"
              maxLength={4}
              style={{ backgroundColor: '#121212', borderColor: '#333333', color: '#FFFFFF' }}
            />
          </div>
          <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(74, 255, 153, 0.1)', borderLeft: '3px solid #4AFF99' }}>
            <p className="text-sm" style={{ color: '#B3B3B3' }}>
              ✅ After confirmation, funds will be released to your wallet and you'll earn gamification points!
            </p>
          </div>
          <Button
            className="w-full"
            style={{ backgroundColor: '#9945FF', color: '#FFFFFF' }}
            onClick={handleConfirmDelivery}
          >
            Confirm & Release Escrow
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
  )
}

export default SellerCart