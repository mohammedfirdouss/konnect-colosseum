"use client";
import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, ShoppingCart, ChevronDown, ChevronUp, Store, MapPin, Star } from 'lucide-react';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { useCart } from '@/contexts/CartContext';
import { useUser } from '@/contexts/UserContext';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useMarketplace } from '@/hooks/useMarketplace';
import { mockProducts } from '@/contants';
import { Product } from '@/interfaces';


export default function ProductDetailPage() {
    const params = useParams();
    const id = params.id;
    const router = useRouter();
    const { addToCart } = useCart();
    const { isMobile } = useIsMobile();
    const { allListings } = useMarketplace();
    const [product, setProduct] = useState<Product | null>(null);
    const [showFeeBreakdown, setShowFeeBreakdown] = useState(false);
    const [isAdding, setIsAdding] = useState(false);


  // Helper to get random product details from blockchain listing
  const getProductDetailsFromListing = (listingAddress: string) => {
    const productNames = [
      'Premium Smartwatch', 'Wireless Headphones', 'Fitness Tracker', 
      'Portable Speaker', 'Gaming Mouse', 'Keyboard Combo', 'Monitor Stand',
      'USB Cable Set', 'Power Bank', 'Phone Case', 'Laptop Stand', 'Webcam'
    ];
    const descriptions = [
      'High-quality product with excellent features and specifications. Perfect for everyday use.',
      'Premium design with modern technology. Built to last with top-notch materials.',
      'Feature-rich product that delivers exceptional performance and value for money.',
      'Well-designed product that combines style and functionality seamlessly.',
    ];
    const images = [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1583394293214-28acd15de0db?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&h=800&fit=crop',
      'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&h=800&fit=crop',
    ];
    
    return {
      name: productNames[parseInt(listingAddress.slice(-2), 16) % productNames.length] || 'Product',
      description: descriptions[parseInt(listingAddress.slice(-3), 16) % descriptions.length] || descriptions[0],
      image: images[parseInt(listingAddress.slice(-4), 16) % images.length] || images[0],
    };
  };

    

    

  useEffect(() => {
    // First, try to find in mock products
    const foundProduct = mockProducts.find(p => p.id === Number(id));
    if (foundProduct) {
      setProduct(foundProduct);
      return;
    }

    // If not found, search in blockchain listings
      if (allListings && allListings.length > 0) {
          
        const blockchainListing = allListings.find((listing: any) => listing.id === id || listing.address === id);
          if (blockchainListing) {
              const details = getProductDetailsFromListing(blockchainListing.address);
              setProduct({
                  id: blockchainListing.address, // Use blockchain address as ID
                  name: details.name,
                  description: details.description,
                  price: blockchainListing.price, // Price is stored as raw number in NGN
                  image: details.image,
                  category: blockchainListing.isService ? 'Service' : blockchainListing.category || 'Electronics',
                  seller: blockchainListing.seller?.toString().substring(0, 8) + '...' || 'Unknown',
                  sellerRating: parseFloat((Math.random() * 1 + 4).toFixed(1)),
                  location: 'Blockchain',
                  deliveryFee: 0,
                  condition: 'New',
                  rating: parseFloat((Math.random() * 1 + 4).toFixed(1)),
              });
        
              console.log("Product found from list", details);
              return;
          }
              // Product not found anywhere
      toast.error('Product not found');
      console.log("Product not found from list", blockchainListing);
    router.push('/marketplace');

      }

  }, [id, router, allListings]);
console.log("Product from page", product);
  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#121212' }}>
        <p style={{ color: '#B3B3B3' }}>Loading...</p>
      </div>
    );
  }

  const platformFee = Math.round(product.price * 0.02); // 2% platform fee
  const gasFee = 500; // Mock SOL gas fee in Naira
  const deliveryFee = product.deliveryFee || 0;
  const totalPrice = product.price + platformFee + gasFee + deliveryFee;

  const handleAddToCart = () => {
    setIsAdding(true);
    
    // Simulate a small delay for better UX
    setTimeout(() => {
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image || '',
        seller: product.seller || '',
        category: product.category,
        type: 'good',
      });
      
      toast.success(`${product.name} added to cart`);
      setIsAdding(false);
    }, 300);
  };

  const handleBuyNow = () => {
    handleAddToCart();
    setTimeout(() => {
      router.push('/cart');
    }, 400);
  };

  return (
    <div 
      className={isMobile ? 'min-h-screen pb-20' : 'min-h-screen pb-8'} 
      style={{ backgroundColor: '#121212' }}
    >
      {/* Header */}
      <div 
        className={isMobile ? 'sticky top-0 z-40 px-4 py-3 flex items-center gap-3' : 'px-8 py-4 flex items-center gap-3'}
        style={{ backgroundColor: '#121212', borderBottom: '1px solid #333333' }}
      >
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg transition-all"
          style={{ color: '#B3B3B3' }}
        >
          <ArrowLeft size={24} />
        </button>
        <h3 style={{ color: '#FFFFFF' }}>Product Details</h3>
      </div>

      {/* Content */}
      <div className={isMobile ? 'px-4 py-6' : 'max-w-7xl mx-auto px-8 py-8'}>
        <div className={isMobile ? 'space-y-6' : 'grid grid-cols-2 gap-8'}>
          {/* Left Column - Image */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="overflow-hidden" style={{ backgroundColor: '#1E1E1E', borderColor: '#333333' }}>
              {product.image ? (
                <ImageWithFallback
                  src={product.image}
                  alt={product.name}
                  className={isMobile ? 'w-full h-64 object-cover' : 'w-full h-96 object-cover'}
                />
              ) : (
                <div 
                  className={isMobile ? 'w-full h-64 flex items-center justify-center' : 'w-full h-96 flex items-center justify-center'}
                  style={{ backgroundColor: '#333333' }}
                >
                  <ShoppingCart size={48} style={{ color: '#666666' }} />
                </div>
              )}
            </Card>

            {/* Seller Info Card - Desktop only */}
            {!isMobile && (
              <Card className="p-4 mt-4" style={{ backgroundColor: '#1E1E1E', borderColor: '#333333' }}>
                <div className="flex items-center gap-3">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: '#9945FF' }}
                  >
                    <Store size={24} style={{ color: '#FFFFFF' }} />
                  </div>
                  <div className="flex-1">
                    <h4 style={{ color: '#FFFFFF' }}>{product.seller}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      {product.sellerRating && (
                        <div className="flex items-center gap-1">
                          <Star size={14} style={{ color: '#FFBF00', fill: '#FFBF00' }} />
                          <span className="text-sm" style={{ color: '#B3B3B3' }}>
                            {product.sellerRating}
                          </span>
                        </div>
                      )}
                      {product.location && (
                        <>
                          <span style={{ color: '#666666' }}>•</span>
                          <div className="flex items-center gap-1">
                            <MapPin size={14} style={{ color: '#666666' }} />
                            <span className="text-sm" style={{ color: '#B3B3B3' }}>
                              {product.location}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    style={{ borderColor: '#9945FF', color: '#9945FF' }}
                  >
                    View Profile
                  </Button>
                </div>
              </Card>
            )}
          </motion.div>

          {/* Right Column - Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="space-y-4"
          >
            {/* Product Info */}
            <Card className="p-6" style={{ backgroundColor: '#1E1E1E', borderColor: '#333333' }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h2 className="mb-2" style={{ color: '#FFFFFF' }}>{product.name}</h2>
                  <div className="flex items-center gap-2 mb-3">
                    <span 
                      className="px-2 py-1 rounded text-xs"
                      style={{ backgroundColor: 'rgba(153, 69, 255, 0.1)', color: '#9945FF' }}
                    >
                      {product.category}
                    </span>
                    {product.condition && (
                      <span 
                        className="px-2 py-1 rounded text-xs"
                        style={{ backgroundColor: 'rgba(74, 255, 153, 0.1)', color: '#4AFF99' }}
                      >
                        {product.condition}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <p style={{ color: '#9945FF' }}>₦{product.price.toLocaleString()}</p>
              </div>

              <div className="mb-4 pb-4" style={{ borderBottom: '1px solid #333333' }}>
                <p style={{ color: '#B3B3B3' }}>{product.description}</p>
              </div>

              {/* Delivery Fee */}
              {deliveryFee > 0 && (
                <div className="flex items-center justify-between py-2">
                  <span style={{ color: '#B3B3B3' }}>Delivery Fee:</span>
                  <span style={{ color: '#FFFFFF' }}>₦{deliveryFee.toLocaleString()}</span>
                </div>
              )}

              {/* Fee Breakdown Toggle */}
              <button
                onClick={() => setShowFeeBreakdown(!showFeeBreakdown)}
                className="w-full flex items-center justify-between py-3 px-4 rounded-lg transition-all"
                style={{ backgroundColor: '#121212' }}
              >
                <span style={{ color: '#B3B3B3' }}>Fee Breakdown</span>
                {showFeeBreakdown ? (
                  <ChevronUp size={20} style={{ color: '#9945FF' }} />
                ) : (
                  <ChevronDown size={20} style={{ color: '#9945FF' }} />
                )}
              </button>

              {/* Expandable Fee Breakdown */}
              {showFeeBreakdown && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-2 p-4 rounded-lg space-y-3"
                  style={{ backgroundColor: '#121212' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: '#666666' }}>Item Price:</span>
                    <span className="text-sm" style={{ color: '#FFFFFF' }}>₦{product.price.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: '#666666' }}>Platform Fee (2%):</span>
                    <span className="text-sm" style={{ color: '#FFFFFF' }}>₦{platformFee.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: '#666666' }}>SOL Gas Fee:</span>
                    <span className="text-sm" style={{ color: '#FFFFFF' }}>₦{gasFee.toLocaleString()}</span>
                  </div>
                  {deliveryFee > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: '#666666' }}>Delivery Fee:</span>
                      <span className="text-sm" style={{ color: '#FFFFFF' }}>₦{deliveryFee.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="h-px" style={{ backgroundColor: '#333333' }} />
                  <div className="flex items-center justify-between">
                    <span style={{ color: '#FFFFFF' }}>Total:</span>
                    <span style={{ color: '#9945FF' }}>₦{totalPrice.toLocaleString()}</span>
                  </div>
                </motion.div>
              )}
            </Card>

            {/* Seller Info Card - Mobile only */}
            {isMobile && (
              <Card className="p-4" style={{ backgroundColor: '#1E1E1E', borderColor: '#333333' }}>
                <div className="flex items-center gap-3">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: '#9945FF' }}
                  >
                    <Store size={24} style={{ color: '#FFFFFF' }} />
                  </div>
                  <div className="flex-1">
                    <h4 style={{ color: '#FFFFFF' }}>{product.seller}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      {product.sellerRating && (
                        <div className="flex items-center gap-1">
                          <Star size={14} style={{ color: '#FFBF00', fill: '#FFBF00' }} />
                          <span className="text-sm" style={{ color: '#B3B3B3' }}>
                            {product.sellerRating}
                          </span>
                        </div>
                      )}
                      {product.location && (
                        <>
                          <span style={{ color: '#666666' }}>•</span>
                          <div className="flex items-center gap-1">
                            <MapPin size={14} style={{ color: '#666666' }} />
                            <span className="text-sm" style={{ color: '#B3B3B3' }}>
                              {product.location}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Action Buttons - Desktop only */}
            {!isMobile && (
              <div className="flex gap-3 mt-6">
                <Button
                  onClick={handleAddToCart}
                  disabled={isAdding}
                  variant="outline"
                  className="flex-1"
                  style={{ borderColor: '#9945FF', color: '#9945FF' }}
                >
                  <ShoppingCart size={20} className="mr-2" />
                  Add to Cart
                </Button>
                <Button
                  onClick={handleBuyNow}
                  disabled={isAdding}
                  className="flex-1"
                  style={{ backgroundColor: '#9945FF', color: '#FFFFFF' }}
                >
                  Buy Now
                </Button>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Action Buttons - Mobile Fixed Bottom */}
      {isMobile && (
        <div 
          className="fixed left-0 right-0 p-4 flex gap-3" 
          style={{ 
            backgroundColor: '#121212', 
            borderTop: '1px solid #333333',
            bottom: '72px',
            zIndex: 60
          }}
        >
          <Button
            onClick={handleAddToCart}
            disabled={isAdding}
            variant="outline"
            className="flex-1"
            style={{ borderColor: '#9945FF', color: '#9945FF' }}
          >
            <ShoppingCart size={20} className="mr-2" />
            Add to Cart
          </Button>
          <Button
            onClick={handleBuyNow}
            disabled={isAdding}
            className="flex-1"
            style={{ backgroundColor: '#9945FF', color: '#FFFFFF' }}
          >
            Buy Now
          </Button>
        </div>
      )}
    </div>
  );
}