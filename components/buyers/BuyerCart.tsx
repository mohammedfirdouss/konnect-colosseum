"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package, Truck, CheckCircle, X, AlertCircle, Eye, Calendar, User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useUser } from '@/contexts/UserContext';
import { useCart } from '@/contexts/CartContext';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/useIsMobile';
import { PendingOrder } from '@/interfaces';
import { useMarketplace } from '@/hooks/useMarketplace';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Keypair, SystemProgram, Transaction } from '@solana/web3.js';
import { 
  getAssociatedTokenAddressSync, 
  createAssociatedTokenAccountInstruction,
  NATIVE_MINT,
  createSyncNativeInstruction,
  createCloseAccountInstruction,
  TOKEN_PROGRAM_ID
} from '@solana/spl-token';



 const BuyerCart = () => {
  const { user, setUser } = useUser();
  const { cartItems, removeFromCart, clearCart, getCartTotal } = useCart();
  const { isMobile } = useIsMobile();
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const { 
    createServiceOrder, 
    buyNow, 
    getMarketplaceAddress, 
    allListings, 
    loading: marketplaceLoading 
  } = useMarketplace();


  const [activeTab, setActiveTab] = useState('pending');
  const [checkoutDialog, setCheckoutDialog] = useState(false);
  const [confirmationDialog, setConfirmationDialog] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
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
  const ongoingOrders = [
    { 
      id: 1, 
      name: 'Campus Hoodie', 
      price: 12500, 
      seller: 'David K.', 
      status: 'In Transit', 
      deliveryCode: '8453', 
      buyer: 'Sarah M.',
      acceptedDate: '2025-10-21'
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

  const handleRemoveItem = (itemId: number, itemName: string) => {
    removeFromCart(itemId);
    toast.success(`${itemName} removed from cart`);
  };

  const handleProceedToCheckout = () => {
    if (cartItems.length === 0) {
      toast.error('Your cart is empty');
      return;
    }
    setCheckoutDialog(true);
  };

  const handleConfirmCheckout = () => {
    if (!deliveryAddress.trim() || !phoneNumber.trim()) {
      toast.error('Please fill in all delivery details');
      return;
    }
    
    setCheckoutDialog(false);
    setConfirmationDialog(true);
  };

  const handleFinalizeOrder = async () => {
    if (!connected || !publicKey) {
      toast.error('Please connect your wallet to proceed');
      return;
    }

    try {
      toast.loading('Processing order...', { id: 'checkout' });
      
      // Get marketplace address
      const marketplaceAddress = getMarketplaceAddress(publicKey) || 
        new PublicKey("44aN6AM28H9LjBSLR833rg8FV6UFQ7XCuPC5vP87EQ76");
      
      // Process each item in the cart
      for (const item of cartItems) {
        // Find the corresponding blockchain listing
        const blockchainListing = allListings.find(
          (listing: any) => listing.address === item.id || listing.id === item.id
        );
        
        if (blockchainListing && item.type === 'service') {
          // For services, create a service order (escrow)
          try {
            const listingPubkey = new PublicKey(blockchainListing.address);
            const mintAddress = NATIVE_MINT; // Use NATIVE_MINT constant
            const reference = Keypair.generate().publicKey; // Generate unique reference
            
            // For native SOL, we need to get the wrapped SOL ATA
            const buyerAta = getAssociatedTokenAddressSync(
              NATIVE_MINT,
              publicKey,
              false
            );
            
            console.log('Service order details:', {
              marketplace: marketplaceAddress.toString(),
              listing: listingPubkey.toString(),
              buyerAta: buyerAta.toString(),
              mint: mintAddress.toString(),
              buyer: publicKey.toString()
            });
            
            await createServiceOrder(
              marketplaceAddress,
              listingPubkey,
              buyerAta,
              mintAddress,
              reference
            );
            
            console.log(`Service order created for: ${item.name}`);
          } catch (error) {
            console.error(`Failed to create service order for ${item.name}:`, error);
            throw error;
          }
        } else if (blockchainListing && item.type === 'good') {
          // For goods, use buyNow (direct purchase)
          try {
            const listingPubkey = new PublicKey(blockchainListing.address);
            const mintAddress = new PublicKey("So11111111111111111111111111111111111111112");
            const reference = Keypair.generate().publicKey;
            
            // Get proper Associated Token Accounts
            const buyerAta = getAssociatedTokenAddressSync(
              mintAddress,
              publicKey,
              false
            );
            const sellerPubkey = new PublicKey(blockchainListing.seller);
            const sellerAta = getAssociatedTokenAddressSync(
              mintAddress,
              sellerPubkey,
              false
            );
            const treasuryAta = getAssociatedTokenAddressSync(
              mintAddress,
              marketplaceAddress,
              false
            );
            
            await buyNow(
              listingPubkey,
              marketplaceAddress,
              buyerAta,
              sellerAta,
              treasuryAta,
              mintAddress,
              1, // quantity
              reference
            );
            
            console.log(`Purchase completed for: ${item.name}`);
          } catch (error) {
            console.error(`Failed to purchase ${item.name}:`, error);
            throw error;
          }
        } else {
          // For mock products or items not found on blockchain
          console.log(`Processing mock item: ${item.name}`);
        }
      }
      
      toast.success('Order placed successfully! Funds are in escrow.', {
        id: 'checkout',
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
      setConfirmationDialog(false);
      setDeliveryAddress('');
      setPhoneNumber('');
      
    } catch (error: any) {
      console.error('Checkout failed:', error);
      toast.error(`Checkout failed: ${error.message}`, { id: 'checkout' });
    }
  };

  const handleViewOrderDetails = (order: PendingOrder) => {
    setSelectedOrder(order);
    setOrderDetailsDialog(true);
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



  const subtotal = getCartTotal();
  const fees = calculateFees(subtotal);
  const total = subtotal + fees;

  return (
    <div className={isMobile ? 'px-4 py-6 space-y-6' : 'max-w-7xl mx-auto px-8 py-8 space-y-6'}>
      <h2 style={{ color: '#FFFFFF' }}>My Cart</h2>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={isMobile ? 'w-full grid grid-cols-3' : 'inline-flex'} style={{ backgroundColor: '#1E1E1E' }}>
          <TabsTrigger 
            value="pending" 
            style={{ 
              color: activeTab === 'pending' ? '#FFFFFF' : '#B3B3B3',
              backgroundColor: activeTab === 'pending' ? '#9945FF' : 'transparent',
            }}
          >
            Pending
          </TabsTrigger>
          <TabsTrigger 
            value="ongoing" 
            style={{ 
              color: activeTab === 'ongoing' ? '#FFFFFF' : '#B3B3B3',
              backgroundColor: activeTab === 'ongoing' ? '#9945FF' : 'transparent',
            }}
          >
            Ongoing
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

        <TabsContent value="pending" className="mt-6">
          {cartItems.length === 0 ? (
            <Card className="p-8 text-center" style={{ backgroundColor: '#1E1E1E', borderColor: '#333333' }}>
              <Package size={48} className="mx-auto mb-4" style={{ color: '#666666' }} />
              <p style={{ color: '#B3B3B3' }}>Your cart is empty</p>
            </Card>
          ) : (
            <div className={isMobile ? 'space-y-3' : 'grid grid-cols-3 gap-6'}>
              {/* Cart Items Section */}
              <div className={isMobile ? '' : 'col-span-2 space-y-3'}>
                {cartItems.map((item) => (
                  <Card key={item.id} className="p-4" style={{ backgroundColor: '#1E1E1E', borderColor: '#333333' }}>
                    <div className="flex gap-4">
                      {item.image ? (
                        <ImageWithFallback
                          src={item.image}
                          alt={item.name}
                          className={isMobile ? 'w-20 h-20 rounded-lg object-cover' : 'w-28 h-28 rounded-lg object-cover'}
                        />
                      ) : (
                        <div className={isMobile ? 'w-20 h-20 rounded-lg' : 'w-28 h-28 rounded-lg'} style={{ backgroundColor: '#333333' }} />
                      )}
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 style={{ color: '#FFFFFF' }}>{item.name}</h3>
                            <p className="text-sm" style={{ color: '#B3B3B3' }}>Seller: {item.seller}</p>
                            <p className="text-sm" style={{ color: '#666666' }}>Category: {item.category}</p>
                            <p className="mt-2" style={{ color: '#9945FF' }}>₦{item.price.toLocaleString()}</p>
                          </div>
                          <button 
                            onClick={() => handleRemoveItem(Number(item?.id), item.name)}
                            className="p-2 rounded-lg hover:bg-opacity-10 transition-all"
                            style={{ backgroundColor: 'rgba(255, 77, 77, 0.1)' }}
                          >
                            <X size={20} style={{ color: '#FF4D4D' }} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Order Summary Section */}
              <div className={isMobile ? '' : 'col-span-1'}>
                <Card className="p-6 sticky top-24" style={{ backgroundColor: '#1E1E1E', borderColor: '#333333' }}>
                  <h3 className="mb-4" style={{ color: '#FFFFFF' }}>Order Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span style={{ color: '#B3B3B3' }}>Subtotal ({cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}):</span>
                      <span style={{ color: '#FFFFFF' }}>₦{subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: '#B3B3B3' }}>Service Fee (2%):</span>
                      <span style={{ color: '#FFFFFF' }}>₦{fees.toLocaleString()}</span>
                    </div>
                    <div className="h-px" style={{ backgroundColor: '#333333' }} />
                    <div className="flex justify-between">
                      <span style={{ color: '#FFFFFF' }}>Total:</span>
                      <span style={{ color: '#9945FF' }}>₦{total.toLocaleString()}</span>
                    </div>
                    <div className="p-3 rounded-lg mt-4" style={{ backgroundColor: 'rgba(153, 69, 255, 0.1)', border: '1px solid #9945FF' }}>
                      <p className="text-xs" style={{ color: '#B3B3B3' }}>
                        🔒 Secure Escrow Payment
                      </p>
                      <p className="text-xs mt-1" style={{ color: '#666666' }}>
                        Your payment is protected until delivery is confirmed
                      </p>
                    </div>
                    {!connected ? (
                      <div className="mt-4 p-3 rounded-lg text-center" style={{ backgroundColor: 'rgba(255, 191, 0, 0.1)', border: '1px solid #FFBF00' }}>
                        <p className="text-sm mb-2" style={{ color: '#FFBF00' }}>
                          Connect your wallet to checkout
                        </p>
                        <p className="text-xs" style={{ color: '#666666' }}>
                          Blockchain transactions require wallet connection
                        </p>
                      </div>
                    ) : (
                      <Button
                        className="w-full mt-4"
                        style={{ backgroundColor: '#9945FF', color: '#FFFFFF' }}
                        onClick={handleProceedToCheckout}
                        disabled={marketplaceLoading}
                      >
                        {marketplaceLoading ? 'Loading...' : 'Proceed to Checkout'}
                      </Button>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="ongoing" className={isMobile ? 'space-y-3 mt-4' : 'grid grid-cols-2 lg:grid-cols-3 gap-4 mt-6'}>
          {ongoingOrders.map((order) => (
            <Card key={order.id} className="p-4" style={{ backgroundColor: '#1E1E1E', borderColor: '#333333' }}>
              <div className="flex gap-3">
                <div className="w-20 h-20 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#333333' }}>
                  <Truck size={32} style={{ color: '#9945FF' }} />
                </div>
                <div className="flex-1">
                  <h3 className="mb-1" style={{ color: '#FFFFFF' }}>{order.name}</h3>
                  <p className="text-sm" style={{ color: '#B3B3B3' }}>Seller: {order.seller}</p>
                  <div className="mt-2 px-2 py-1 rounded inline-block text-xs" style={{ backgroundColor: '#FFBF00', color: '#121212' }}>
                    {order.status}
                  </div>
                  <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: '#121212' }}>
                    <p className="text-sm mb-1" style={{ color: '#B3B3B3' }}>Your Delivery Code:</p>
                    <p className="text-xl" style={{ color: '#9945FF' }}>{order.deliveryCode}</p>
                    <p className="text-xs mt-2" style={{ color: '#666666' }}>
                      Share this code with seller upon delivery
                    </p>
                  </div>
                  <Button
                    className="w-full mt-3"
                    size="sm"
                    variant="outline"
                    style={{ borderColor: '#9945FF', color: '#9945FF' }}
                    onClick={() => router.push(`/order/${order.id}`)}
                  >
                    Track Order
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="completed" className={isMobile ? 'space-y-3 mt-4' : 'grid grid-cols-2 lg:grid-cols-3 gap-4 mt-6'}>
          {completedOrders.map((order) => (
            <Card key={order.id} className="p-4" style={{ backgroundColor: '#1E1E1E', borderColor: '#333333' }}>
              <div className="flex gap-3">
                <div className="w-20 h-20 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#4AFF99' }}>
                  <CheckCircle size={32} style={{ color: '#121212' }} />
                </div>
                <div className="flex-1">
                  <h3 className="mb-1" style={{ color: '#FFFFFF' }}>{order.name}</h3>
                  <p className="text-sm" style={{ color: '#B3B3B3' }}>Seller: {order.seller}</p>
                  <p className="text-sm" style={{ color: '#B3B3B3' }}>Delivered: {order.date}</p>
                  <p className="mt-2" style={{ color: '#4AFF99' }}>₦{order.price.toLocaleString()}</p>
                  {!order.rated && (
                    <Button
                      className="w-full mt-3"
                      size="sm"
                      style={{ backgroundColor: '#9945FF', color: '#FFFFFF' }}
                    >
                      Rate Seller
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Checkout Dialog - Step 1: Enter delivery details */}
      <Dialog open={checkoutDialog} onOpenChange={setCheckoutDialog}>
        <DialogContent style={{ backgroundColor: '#1E1E1E', borderColor: '#333333' }}>
          <DialogHeader>
            <DialogTitle style={{ color: '#FFFFFF' }}>Checkout</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg" style={{ backgroundColor: '#121212' }}>
              <h4 className="mb-2" style={{ color: '#FFFFFF' }}>Order Summary</h4>
              <div className="space-y-2">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span style={{ color: '#B3B3B3' }}>{item.name}</span>
                    <span style={{ color: '#FFFFFF' }}>₦{item.price.toLocaleString()}</span>
                  </div>
                ))}
                <div className="h-px" style={{ backgroundColor: '#333333' }} />
                <div className="flex justify-between">
                  <span style={{ color: '#FFFFFF' }}>Total</span>
                  <span style={{ color: '#9945FF' }}>₦{total.toLocaleString()}</span>
                </div>
              </div>
            </div>
            
            <div>
              <Label style={{ color: '#B3B3B3' }}>Delivery Address</Label>
              <Input
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Enter your delivery address"
                style={{ backgroundColor: '#121212', borderColor: '#333333', color: '#FFFFFF' }}
              />
            </div>
            
            <div>
              <Label style={{ color: '#B3B3B3' }}>Phone Number</Label>
              <Input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Enter your phone number"
                style={{ backgroundColor: '#121212', borderColor: '#333333', color: '#FFFFFF' }}
              />
            </div>

            <div className="p-3 rounded-lg flex gap-3" style={{ backgroundColor: 'rgba(255, 191, 0, 0.1)', border: '1px solid #FFBF00' }}>
              <AlertCircle size={20} style={{ color: '#FFBF00' }} />
              <div>
                <p className="text-sm" style={{ color: '#FFBF00' }}>
                  Funds will be held in escrow until delivery is confirmed
                </p>
              </div>
            </div>

            <Button
              className="w-full"
              style={{ backgroundColor: '#9945FF', color: '#FFFFFF' }}
              onClick={handleConfirmCheckout}
            >
              Continue to Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog - Step 2: Confirm and pay */}
      <AlertDialog open={confirmationDialog} onOpenChange={setConfirmationDialog}>
        <AlertDialogContent style={{ backgroundColor: '#1E1E1E', borderColor: '#333333' }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: '#FFFFFF' }}>Confirm Order</AlertDialogTitle>
            <AlertDialogDescription style={{ color: '#B3B3B3' }}>
              You are about to place an order for ₦{total.toLocaleString()}. Funds will be held in escrow and released to the seller upon successful delivery confirmation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 my-4">
            <div className="p-3 rounded-lg" style={{ backgroundColor: '#121212' }}>
              <p className="text-sm mb-1" style={{ color: '#B3B3B3' }}>Delivery Address:</p>
              <p className="text-sm" style={{ color: '#FFFFFF' }}>{deliveryAddress}</p>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: '#121212' }}>
              <p className="text-sm mb-1" style={{ color: '#B3B3B3' }}>Phone Number:</p>
              <p className="text-sm" style={{ color: '#FFFFFF' }}>{phoneNumber}</p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ borderColor: '#333333', color: '#B3B3B3' }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              style={{ backgroundColor: '#9945FF', color: '#FFFFFF' }}
              onClick={handleFinalizeOrder}
            >
              Confirm & Pay
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


export default BuyerCart;