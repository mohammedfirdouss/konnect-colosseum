import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Store, ArrowRight } from 'lucide-react';
import { useUser, UserRole } from '../contexts/UserContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { useWallet } from '@solana/wallet-adapter-react';
import { useMarketplace } from '@/hooks/useMarketplace';
import { useState } from 'react';
import { toast } from 'sonner';
import { PublicKey } from '@solana/web3.js';

export function RoleSelection() {
  const router = useRouter();
  const { user, setUser } = useUser();
  const { isMobile } = useIsMobile();
  const { connected, publicKey } = useWallet();
  const { getMarketplaceAddress, registerMerchant } = useMarketplace();
  const [loading, setLoading] = useState(false);

  const handleRoleSelect = async (role: UserRole) => {
    setLoading(true);
    
    try {
      // If user selects seller or both role, register them as merchant
      if ((role === 'seller' || role === 'both') && connected && publicKey) {
        try {
          toast.loading('Registering as merchant...', { id: 'register-merchant' });
          
          // Get marketplace address
          const marketplaceAddress = getMarketplaceAddress(publicKey) || new PublicKey("44aN6AM28H9LjBSLR833rg8FV6UFQ7XCuPC5vP87EQ76");
          // console.log('marketplaceAddress', marketplaceAddress);

          console.log('Marketplace PDA:', marketplaceAddress?.toString());
          
          if (marketplaceAddress) {
            const tx = await registerMerchant(marketplaceAddress, publicKey);
          console.log('tx', tx);
            // 2SJDd6nCBMbfD8T4ZCedhvLzLbzrTCvr2uKtBxu32T6k1xdibc3ewznh75fHNhvGRLH4ZCkJ2r5B8FXnvhdmrQB

              // Update user role
      if (user) {
        setUser({
          ...user,
          role,
          marketplaceAddress: marketplaceAddress?.toString() || "44aN6AM28H9LjBSLR833rg8FV6UFQ7XCuPC5vP87EQ76",
          merchantId: tx?.toString() || "2SJDd6nCBMbfD8T4ZCedhvLzLbzrTCvr2uKtBxu32T6k1xdibc3ewznh75fHNhvGRLH4ZCkJ2r5B8FXnvhdmrQB", 
        });
      }
      router.push('/home');
            toast.success('Successfully registered as merchant!', { id: 'register-merchant' });
          }


        } catch (error: any) {
          console.error('Error registering merchant:', error);
          toast.error(`Failed to register merchant: ${error.message}`, { id: 'register-merchant' });
        }
      }

      router.push('/home');

      
      // Update user role
      if (user) {
        setUser({
          ...user,
          role,
  
        });
      }
      
      // router.push('/personal-info');
    } catch (error) {
      console.error('Error in role selection:', error);
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    {
      id: 'buyer',
      icon: <ShoppingBag size={isMobile ? 24 : 32} color="#FFFFFF" />,
      title: 'Buyer',
      description: 'Browse and purchase goods & services',
      features: ['Secure escrow payments', 'AI recommendations', 'Track orders'],
    },
    {
      id: 'seller',
      icon: <Store size={isMobile ? 24 : 32} color="#FFFFFF" />,
      title: 'Seller',
      description: 'List and sell your goods & services',
      features: ['Create listings', 'Manage orders', 'Track sales'],
    },
    {
      id: 'both',
      icon: (
        <div className="flex">
          <ShoppingBag size={isMobile ? 16 : 20} color="#FFFFFF" />
          <Store size={isMobile ? 16 : 20} color="#FFFFFF" className="ml-0.5" />
        </div>
      ),
      title: 'Both',
      description: 'Buy and sell on the platform',
      features: ['Full marketplace access', 'Dual dashboard', 'Maximum flexibility'],
    },
  ];

  return (
    <div 
      className="min-h-screen flex items-center justify-center px-6"
      style={{ backgroundColor: '#121212' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={`w-full ${isMobile ? 'max-w-md' : 'max-w-5xl'}`}
      >
        <div className="text-center mb-8">
          <h2 
            className={`mb-3 ${isMobile ? '' : 'text-4xl'}`}
            style={{ color: '#FFFFFF' }}
          >
            Choose Your Role
          </h2>
          <p 
            className={isMobile ? '' : 'text-lg'}
            style={{ color: '#B3B3B3' }}
          >
            Select how you want to use Konnect
          </p>
        </div>

        {/* Progress Indicator */}
        <div className={`flex gap-2 mb-${isMobile ? '8' : '12'} max-w-md mx-auto`}>
          <div className="h-1 flex-1 rounded-full" style={{ backgroundColor: '#9945FF' }} />
          <div className="h-1 flex-1 rounded-full" style={{ backgroundColor: '#333333' }} />
          <div className="h-1 flex-1 rounded-full" style={{ backgroundColor: '#333333' }} />
          <div className="h-1 flex-1 rounded-full" style={{ backgroundColor: '#333333' }} />
        </div>

        <div className={isMobile ? 'space-y-4' : 'grid grid-cols-3 gap-6'}>
          {roles.map((role) => (
            <motion.button
              key={role.id}
              onClick={() => handleRoleSelect(role.id as UserRole)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full ${isMobile ? 'p-6' : 'p-8'} rounded-2xl transition-all group`}
              style={{ 
                backgroundColor: '#1E1E1E', 
                border: '2px solid #333333',
              }}
            >
              <div className={isMobile ? 'flex items-center gap-4' : 'text-center'}>
                <div 
                  className={`${isMobile ? 'w-12 h-12' : 'w-20 h-20 mx-auto mb-4'} rounded-full flex items-center justify-center transition-all group-hover:scale-110`}
                  style={{ backgroundColor: '#9945FF' }}
                >
                  {role.icon}
                </div>
                
                <div className={isMobile ? 'text-left flex-1' : ''}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 
                      className={isMobile ? '' : 'text-2xl'}
                      style={{ color: '#FFFFFF' }}
                    >
                      {role.title}
                    </h3>
                    {isMobile && (
                      <ArrowRight size={20} style={{ color: '#9945FF' }} />
                    )}
                  </div>
                  <p 
                    className={`text-sm ${!isMobile ? 'mb-6' : ''}`}
                    style={{ color: '#B3B3B3' }}
                  >
                    {role.description}
                  </p>
                </div>
              </div>

              {!isMobile && (
                <div className="space-y-2 mt-4">
                  {role.features.map((feature, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-2 text-left px-4 py-2 rounded-lg"
                      style={{ backgroundColor: '#121212' }}
                    >
                      <div 
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: '#9945FF' }}
                      />
                      <span className="text-sm" style={{ color: '#B3B3B3' }}>
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.button>
          ))}
        </div>

        {!isMobile && (
          <div className="text-center mt-8">
            <p className="text-sm" style={{ color: '#666666' }}>
              You can change your role later in settings
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
