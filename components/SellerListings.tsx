
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Package, TrendingUp, DollarSign, Eye } from 'lucide-react';
import { useIsMobile } from '@/hooks/useIsMobile';
import CreateListingModal from './CreateListingModal';
import { myListings } from '@/contants';

const SellerListings = () => {
    const { isMobile } = useIsMobile();
    const totalRevenue = myListings.reduce((sum, listing) => sum + (listing.price * listing.sales), 0);
    const totalSales = myListings.reduce((sum, listing) => sum + listing.sales, 0);
    const activeListings = myListings.filter(l => l.status === 'active').length;

  return (
    <div className={`${isMobile ? 'px-4' : 'px-8 max-w-7xl mx-auto'} py-6 space-y-6`}>
        {/* Header with Stats */}
        <div className="flex items-center justify-between">
          <h2 style={{ color: '#FFFFFF' }}>My Listings</h2>
         <CreateListingModal/>
        </div>

        {/* Analytics Cards */}
        <div className={`grid gap-4 ${isMobile ? 'grid-cols-2' : 'grid-cols-4'}`}>
          <Card className="p-4" style={{ backgroundColor: '#1E1E1E', borderColor: '#333333' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(153, 69, 255, 0.2)' }}>
                <Package size={20} style={{ color: '#9945FF' }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: '#B3B3B3' }}>Active</p>
                <p className="text-xl" style={{ color: '#FFFFFF' }}>{activeListings}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4" style={{ backgroundColor: '#1E1E1E', borderColor: '#333333' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(74, 255, 153, 0.2)' }}>
                <TrendingUp size={20} style={{ color: '#4AFF99' }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: '#B3B3B3' }}>Total Sales</p>
                <p className="text-xl" style={{ color: '#FFFFFF' }}>{totalSales}</p>
              </div>
            </div>
          </Card>

          <Card className={`p-4 ${isMobile ? 'col-span-2' : ''}`} style={{ backgroundColor: '#1E1E1E', borderColor: '#333333' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(255, 191, 0, 0.2)' }}>
                <DollarSign size={20} style={{ color: '#FFBF00' }} />
              </div>
              <div>
                <p className="text-sm" style={{ color: '#B3B3B3' }}>Revenue</p>
                <p className="text-xl" style={{ color: '#FFFFFF' }}>₦{totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Listings Grid */}
        <div className={`grid gap-4 ${isMobile ? 'grid-cols-2' : 'grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'}`}>
          {myListings.map((listing) => (
            <Card 
              key={listing.id} 
              className="overflow-hidden" 
              style={{ backgroundColor: '#1E1E1E', borderColor: '#333333' }}
            >
              <div className="aspect-square relative" style={{ backgroundColor: '#333333' }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Package size={48} style={{ color: '#666666' }} />
                </div>
                <div 
                  className="absolute top-2 right-2 px-2 py-1 rounded text-xs"
                  style={{
                    backgroundColor: listing.status === 'active' ? '#4AFF99' : '#666666',
                    color: '#121212'
                  }}
                >
                  {listing.status}
                </div>
              </div>
              <div className="p-3">
                <h3 className="text-sm mb-1 truncate" style={{ color: '#FFFFFF' }}>
                  {listing.name}
                </h3>
                <p className="text-xs mb-2 truncate" style={{ color: '#666666' }}>
                  {listing.description}
                </p>
                <p className="mb-2" style={{ color: '#9945FF' }}>
                  ₦{listing.price.toLocaleString()}
                </p>
                <div className="flex items-center justify-between text-xs mb-3" style={{ color: '#B3B3B3' }}>
                  <div className="flex items-center gap-1">
                    <Eye size={12} />
                    <span>{listing.views}</span>
                  </div>
                  <span>{listing.sales} sales</span>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1 text-xs" 
                    style={{ borderColor: '#9945FF', color: '#9945FF' }}
                  >
                    Edit
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-xs"
                    style={{ borderColor: '#FF4D4D', color: '#FF4D4D' }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
  )
}

export default SellerListings