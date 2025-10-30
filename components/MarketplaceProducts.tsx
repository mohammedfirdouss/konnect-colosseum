import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heart, Star, ShoppingCart } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { useCart } from '@/contexts/CartContext';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { useIsMobile } from '@/hooks/useIsMobile';
import { toast } from 'sonner';
import { Product } from '@/interfaces';
import { goods, services } from '@/contants';
import { useWallet } from '@solana/wallet-adapter-react';
import { useMarketplace } from '@/hooks/useMarketplace';

const MarketplaceProducts = () => {
    const { user } = useUser();
    const { isMobile } = useIsMobile();
    const { addToCart } = useCart();
    const router = useRouter();
    
    // if (!user) return null;
  
    const [activeCategory, setActiveCategory] = useState<'goods' | 'services'>('goods');
    const [selectedSubCategory, setSelectedSubCategory] = useState<string>('All');


    const { allListings, listingsLoading } = useMarketplace();

    // Helper function to get random product details
    const getRandomProductDetails = (address: string) => {
        const productNames = [
            'Premium Smartwatch', 'Wireless Headphones', 'Fitness Tracker', 
            'Portable Speaker', 'Gaming Mouse', 'Keyboard Combo', 'Monitor Stand',
            'USB Cable Set', 'Power Bank', 'Phone Case', 'Laptop Stand', 'Webcam'
        ];
        const serviceNames = [
            'Web Development', 'Logo Design', 'UI/UX Design', 'Content Writing',
            'Video Editing', 'Social Media Management', 'SEO Optimization', 'Marketing Strategy'
        ];
        const images = [
            'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
            'https://images.unsplash.com/photo-1583394293214-28acd15de0db?w=400&h=400&fit=crop',
            'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop',
            'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop',
            'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400&h=400&fit=crop',
            'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&h=400&fit=crop',
        ];
        
        return {
            name: productNames[parseInt(address.slice(-2), 16) % productNames.length] || 'Product',
            image: images[parseInt(address.slice(-3), 16) % images.length] || images[0],
            rating: (Math.random() * 2 + 3).toFixed(1),
        };
    };

    // Transform blockchain listings to Product format
    const blockchainProducts: Product[] = allListings.map((listing: any) => {
        const details = getRandomProductDetails(listing.address);
        return {
            id: listing.address,
            name: details.name,
            price: listing.price, // Price is stored as raw number in NGN
            seller: listing.seller,
            category: listing.isService ? 'Service' : 'Good',
            image: details.image,
            rating: parseFloat(details.rating),
        };
    });

    // Combine blockchain products with mock products
    const allGoods =  [...blockchainProducts.filter(p => !p.category.includes('Service'))];
    const allServices = [...services, ...blockchainProducts.filter(p => p.category.includes('Service'))];

    const handleAddToCart = (product: Product, type: 'good' | 'service') => {
        addToCart({
          id: product.id,
          name: product.name,
          price: product.price,
          seller: product.seller || "",
          category: product.category,
          image: product.image,
          type,
        });
        toast.success(`${product.name} added to cart!`, {
          duration: 2000,
        });
      };
    
    
      const goodsCategories = ['All', 'Hot Deals', 'Fashion', 'Beauty and Personal Care', 'Electronics', 'Books', 'Home & Living'];
      const servicesCategories = ['All', 'Education', 'Design', 'Tech', 'Media', 'Transportation'];

    const filteredGoods =
    selectedSubCategory === 'All'
      ? allGoods
      : allGoods.filter((item) => item.category === selectedSubCategory || selectedSubCategory === 'Hot Deals');

  const filteredServices =
    selectedSubCategory === 'All'
      ? allServices
      : allServices.filter((item) => item.category === selectedSubCategory);

    const currentCategories = activeCategory === 'goods' ? goodsCategories : servicesCategories;

    // Debug logging
    useEffect(() => {
        console.log("Blockchain Listings:", allListings);
        console.log("Total Goods:", allGoods.length, "Total Services:", allServices.length);
    }, [allListings]);
  return (
    <div
      className={`${
        isMobile ? "px-4" : "px-8 max-w-7xl mx-auto"
      } py-6 space-y-6`}
    >
      {/* Goods/Services Tabs */}
      <Tabs
        value={activeCategory}
        onValueChange={(v) => setActiveCategory(v as "goods" | "services")}
      >
        <div className="flex items-center justify-between mb-6">
          <TabsList
            className={`${isMobile ? "grid grid-cols-2" : "inline-flex"}`}
            style={{ backgroundColor: "#1E1E1E" }}
          >
            <TabsTrigger
              value="goods"
              className="px-8 py-2"
              style={{
                backgroundColor:
                  activeCategory === "goods" ? "#9945FF" : "transparent",
                color: activeCategory === "goods" ? "#FFFFFF" : "#B3B3B3",
              }}
            >
              Goods
            </TabsTrigger>
            <TabsTrigger
              value="services"
              className="px-8 py-2"
              style={{
                backgroundColor:
                  activeCategory === "services" ? "#9945FF" : "transparent",
                color: activeCategory === "services" ? "#FFFFFF" : "#B3B3B3",
              }}
            >
              Services
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Category Filters */}
        <div className="flex gap-3 overflow-x-auto pb-4 mb-6 scrollbar-hide">
          {currentCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedSubCategory(cat)}
              className="px-5 py-2 rounded-full whitespace-nowrap transition-all text-sm"
              style={{
                backgroundColor:
                  selectedSubCategory === cat ? "#9945FF" : "#1E1E1E",
                color: selectedSubCategory === cat ? "#FFFFFF" : "#B3B3B3",
                border:
                  selectedSubCategory === cat ? "none" : "1px solid #333333",
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Loading State for Blockchain Data */}
        {listingsLoading && (
          <div className="text-center py-8">
            <div className="inline-block w-8 h-8 border-4 border-[#9945FF] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[#B3B3B3] mt-4">Loading listings...</p>
          </div>
        )}

        {/* Blockchain Listings Count */}
        {!listingsLoading && allListings.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-[#9945FF]/10 border border-[#9945FF]/20">
            <p className="text-sm text-center text-[#9945FF]">
              🚀 {allListings.length} listing{allListings.length > 1 ? "s" : ""}{" "}
            </p>
          </div>
        )}

        {/* Goods Tab Content */}
        <TabsContent value="goods" className="mt-0">
          <div
            className={`grid gap-5 ${
              isMobile
                ? "grid-cols-2"
                : "grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            }`}
          >
            {filteredGoods.map((item) => (
              <Card
                key={item.id}
                className="overflow-hidden group cursor-pointer transition-all hover:shadow-lg hover:scale-105"
                style={{ backgroundColor: "#1E1E1E", borderColor: "#333333" }}
                onClick={() => router.push(`/product/${item.id}`)}
              >
                <div className="relative aspect-square overflow-hidden">
                  <ImageWithFallback
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                  />
                  <button
                    className="absolute top-3 right-3 p-2 rounded-full transition-all backdrop-blur-sm"
                    style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Heart size={16} style={{ color: "#FFFFFF" }} />
                  </button>
                </div>
                <div className="p-3 space-y-2">
                  <h3 className="text-sm truncate" style={{ color: "#FFFFFF" }}>
                    {item.name}
                  </h3>
                  <div className="flex items-center gap-1">
                    <Star
                      size={14}
                      fill="#FFBF00"
                      style={{ color: "#FFBF00" }}
                    />
                    <span className="text-xs" style={{ color: "#FFBF00" }}>
                      {item.rating}
                    </span>
                    <span className="text-xs ml-1" style={{ color: "#666666" }}>
                      ({Math.floor(Math.random() * 500) + 100})
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: "#9945FF" }}>
                    ₦{item.price.toLocaleString()}
                  </p>
                  <Button
                    className="w-full"
                    size="sm"
                    style={{ backgroundColor: "#9945FF", color: "#FFFFFF" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToCart(item, "good");
                    }}
                  >
                    <ShoppingCart size={16} className="mr-2" />
                    Add to Cart
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Services Tab Content */}
        <TabsContent value="services" className="mt-0">
          <div
            className={`grid gap-5 ${
              isMobile
                ? "grid-cols-2"
                : "grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
            }`}
          >
            {filteredServices.map((item) => (
              <Card
                key={item.id}
                className="overflow-hidden group cursor-pointer transition-all hover:shadow-lg hover:scale-105"
                style={{ backgroundColor: "#1E1E1E", borderColor: "#333333" }}
                onClick={() => router.push(`/product/${item.id}`)}
              >
                <div
                  className="aspect-square flex items-center justify-center"
                  style={{ backgroundColor: "#333333" }}
                >
                  <div className="text-center">
                    <div
                      className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
                      style={{ backgroundColor: "#9945FF" }}
                    >
                      <span className="text-3xl">
                        {item.category === "Education" && "📚"}
                        {item.category === "Design" && "🎨"}
                        {item.category === "Tech" && "💻"}
                        {item.category === "Media" && "📸"}
                        {item.category === "Transportation" && "🚗"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  <h3 className="text-sm truncate" style={{ color: "#FFFFFF" }}>
                    {item.name}
                  </h3>
                  <div className="flex items-center gap-1">
                    <Star
                      size={14}
                      fill="#FFBF00"
                      style={{ color: "#FFBF00" }}
                    />
                    <span className="text-xs" style={{ color: "#FFBF00" }}>
                      {item.rating}
                    </span>
                    <span className="text-xs ml-1" style={{ color: "#666666" }}>
                      ({Math.floor(Math.random() * 300) + 50})
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: "#9945FF" }}>
                    ₦{item.price.toLocaleString()}
                  </p>
                  <Button
                    className="w-full"
                    size="sm"
                    style={{ backgroundColor: "#9945FF", color: "#FFFFFF" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToCart(item, "service");
                    }}
                  >
                    <ShoppingCart size={16} className="mr-2" />
                    Book Service
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default MarketplaceProducts