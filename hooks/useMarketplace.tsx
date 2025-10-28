import { useState, useCallback, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
// import { MarketplaceService } from '../services/marketplaceService';
import { toast } from 'sonner';
import { useSmartContract } from './useSmartContract';
import { useWallet } from '@solana/wallet-adapter-react';
import MarketplaceService from '@/services/marketplaceService';

export const useMarketplace = () => {
  const { program, programId } = useSmartContract();
  const { publicKey, connected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<string | null>(null);
  const [allListings, setAllListings] = useState<any[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  
  // Get marketplace PDA address for current wallet
  const getMarketplaceAddress = useCallback((authority: PublicKey | null): PublicKey | null => {
    if (!authority || !program || !programId) {
      return null;
    }
    
    try {
      const marketplaceService = new MarketplaceService(program, programId);
      return marketplaceService.getMarketplaceAddress(authority);
    } catch (error) {
      console.error('Error getting marketplace address:', error);
      return null;
    }
  }, [program, programId]);

  // Get marketplace address for currently connected wallet
  const marketplaceAddress = publicKey ? getMarketplaceAddress(publicKey) : new PublicKey("44aN6AM28H9LjBSLR833rg8FV6UFQ7XCuPC5vP87EQ76");

  // Function to fetch all listings
  const fetchAllListings = useCallback(async () => {
    if (!connected || !program || !publicKey) {
      setAllListings([]);
      return;
    }

    try {
      setListingsLoading(true);
      const marketplaceService = new MarketplaceService(program, programId);
      
      // Get marketplace address on-demand
      const marketplace = getMarketplaceAddress(publicKey);
      if (!marketplace) {
        setAllListings([]);
        return;
      }
      
      const listings = await marketplaceService.getAllListings(marketplace);
      setAllListings(listings);
      console.log('Fetched all listings:', listings.length);
    } catch (error) {
      console.error('Error fetching all listings:', error);
      setAllListings([]);
    } finally {
      setListingsLoading(false);
    }
  }, [connected, program, programId, publicKey, getMarketplaceAddress]);

  // Auto-fetch listings when wallet connects or changes
  useEffect(() => {
    if (connected && publicKey) {
      fetchAllListings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, publicKey?.toString()]);

  const initMarketplace = useCallback(async (feeBps: number) => {
    try {
      if (!connected || !publicKey) {
        throw new Error('Wallet not connected');
      }
      
      if (!program) {
        throw new Error('Program not initialized');
      }
      
      // Prevent duplicate transactions
      if (loading) {
        console.log('Transaction already in progress, skipping...');
        return;
      }
      
      setLoading(true);
      
      const marketplaceService = new MarketplaceService(program, programId);
      const tx = await marketplaceService.initMarketplace(
        publicKey,
        feeBps
      );
      
      setLastTransaction(tx);
      toast.success('Marketplace initialized successfully!');
      console.log('Marketplace initialized with transaction:', tx);
      return tx;
    } catch (error: any) {
      console.error('Failed to initialize marketplace:', error);
      
      // Handle specific error cases
      if (error.message?.includes('already been processed') || error.message?.includes('already initialized')) {
        toast.success('Marketplace was already initialized!');
        return 'already-initialized'; // Return a success indicator
      } else if (error.message?.includes('User rejected')) {
        toast.error('Transaction was cancelled');
        return null;
      } else {
        toast.error(`Failed to initialize marketplace: ${error.message}`);
        throw error;
      }
    } finally {
      setLoading(false);
    }
  }, [program, programId, publicKey, connected, loading, lastTransaction]);

  // Register Merchant
  const registerMerchant = useCallback(async (marketplace: PublicKey, owner: PublicKey) => {
    try {
      if (!connected || !publicKey) {
        throw new Error('Wallet not connected');
      }
      
      if (!program) {
        throw new Error('Program not initialized');
      }
      
      setLoading(true);
      
      const marketplaceService = new MarketplaceService(program, programId);
      const tx = await marketplaceService.registerMerchant(marketplace, owner);
      
      toast.success('Successfully registered as merchant!');
      console.log('Merchant registration successful:', tx);
      return tx;
    } catch (error: any) {
      console.error('Failed to register merchant:', error);
      
      if (error.message?.includes('User rejected')) {
        toast.error('Transaction was cancelled');
      } else {
        toast.error(`Failed to register merchant: ${error.message}`);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, [program, programId, publicKey, connected]);

  const createListing = useCallback(async (
    marketplace: PublicKey,
    merchant: PublicKey,
    mint: PublicKey,
    price: number,
    quantity: number,
    isService: boolean
  ) => {
    try {
      if (!connected || !publicKey) {
        throw new Error('Wallet not connected');
      }
      
      if (!program) {
        throw new Error('Program not initialized');
      }
      
      setLoading(true);
      
      const marketplaceService = new MarketplaceService(program, programId);
      const tx = await marketplaceService.createListing(
        marketplace,
        merchant,
        publicKey,
        mint,
        price,
        quantity,
        isService
      );
      toast.success('Listing created!');
      
      // Refresh listings after creating a new one
      await fetchAllListings();
      
      return tx;
    } catch (error: any) {
      console.error('Error creating listing:', error);
      
      // Handle duplicate transaction error
      if (error.message?.includes('already been processed')) {
        toast.success('Listing was already created!');
        return 'already-processed';
      } else if (error.message?.includes('User rejected')) {
        toast.error('Transaction was cancelled');
      } else {
        toast.error(`Failed to create listing: ${error.message}`);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, [program, programId, publicKey, connected, fetchAllListings]);

  const buyNow = useCallback(async (
    listing: PublicKey,
    marketplace: PublicKey,
    buyerAta: PublicKey,
    sellerAta: PublicKey,
    treasuryAta: PublicKey,
    mint: PublicKey,
    quantity: number,
    reference: PublicKey
  ) => {
    try {
      if (!connected || !publicKey) {
        throw new Error('Wallet not connected');
      }
      
      if (!program) {
        throw new Error('Program not initialized');
      }
      
      setLoading(true);
      
      const marketplaceService = new MarketplaceService(program, programId);
      const tx = await marketplaceService.buyNow(
        listing,
        marketplace,
        publicKey,
        buyerAta,
        sellerAta,
        treasuryAta,
        mint,
        quantity,
        reference
      );
      toast.success('Purchase completed!');
      return tx;
    } catch (error) {
      toast.error('Failed to complete purchase');
      console.error(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [program, programId, publicKey, connected]);

  // Get all listings for a marketplace
  const getAllListings = useCallback(async (marketplace: PublicKey) => {
    try {
      if (!connected || !publicKey) {
        throw new Error('Wallet not connected');
      }
      
      if (!program) {
        throw new Error('Program not initialized');
      }
      
      const marketplaceService = new MarketplaceService(program, programId);
      return await marketplaceService.getAllListings(marketplace);
    } catch (error) {
      console.error('Failed to fetch listings:', error);
      throw error;
    }
  }, [program, programId, publicKey, connected]);

  // Get active listings only
  const getActiveListings = useCallback(async (marketplace: PublicKey) => {
    try {
      if (!connected || !publicKey) {
        throw new Error('Wallet not connected');
      }
      
      if (!program) {
        throw new Error('Program not initialized');
      }
      
      const marketplaceService = new MarketplaceService(program, programId);
      return await marketplaceService.getActiveListings(marketplace);
    } catch (error) {
      console.error('Failed to fetch active listings:', error);
      throw error;
    }
  }, [program, programId, publicKey, connected]);

  // Get listings by seller
  const getListingsBySeller = useCallback(async (marketplace: PublicKey, seller: PublicKey) => {
    try {
      if (!connected || !publicKey) {
        throw new Error('Wallet not connected');
      }
      
      if (!program) {
        throw new Error('Program not initialized');
      }
      
      const marketplaceService = new MarketplaceService(program, programId);
      return await marketplaceService.getListingsBySeller(marketplace, seller);
    } catch (error) {
      console.error('Failed to fetch seller listings:', error);
      throw error;
    }
  }, [program, programId, publicKey, connected]);

  // Get merchant information
  const getMerchant = useCallback(async (marketplace: PublicKey, owner: PublicKey) => {
    try {
      if (!connected || !publicKey) {
        throw new Error('Wallet not connected');
      }
      
      if (!program) {
        throw new Error('Program not initialized');
      }
      
      const marketplaceService = new MarketplaceService(program, programId);
      return await marketplaceService.getMerchant(marketplace, owner);
    } catch (error) {
      console.error('Failed to fetch merchant:', error);
      throw error;
    }
  }, [program, programId, publicKey, connected]);

  // Get marketplace information
  const getMarketplace = useCallback(async (authority: PublicKey) => {
    try {
      if (!connected || !publicKey) {
        throw new Error('Wallet not connected');
      }
      
      if (!program) {
        throw new Error('Program not initialized');
      }
      
      const marketplaceService = new MarketplaceService(program, programId);
      return await marketplaceService.getMarketplace(authority);
    } catch (error) {
      console.error('Failed to fetch marketplace:', error);
      throw error;
    }
  }, [program, programId, publicKey, connected]);

  // Get all merchants for a marketplace
  const getAllMerchants = useCallback(async (marketplace: PublicKey) => {
    try {
      if (!connected || !publicKey) {
        throw new Error('Wallet not connected');
      }
      
      if (!program) {
        throw new Error('Program not initialized');
      }
      
      const marketplaceService = new MarketplaceService(program, programId);
      return await marketplaceService.getAllMerchants(marketplace);
    } catch (error) {
      console.error('Failed to fetch merchants:', error);
      throw error;
    }
  }, [program, programId, publicKey, connected]);
    
    
    

  // Create Service Order
  const createServiceOrder = useCallback(async (
    marketplace: PublicKey,
    listing: PublicKey,
    buyerAta: PublicKey,
    mint: PublicKey,
    reference: PublicKey
  ) => {
    try {
      if (!connected || !publicKey) {
        throw new Error('Wallet not connected');
      }
      
      if (!program) {
        throw new Error('Program not initialized');
      }
      
      setLoading(true);
      
      const marketplaceService = new MarketplaceService(program, programId);
      const tx = await marketplaceService.createServiceOrder(
        marketplace,
        listing,
        publicKey,
        buyerAta,
        mint,
        reference
      );
      
      toast.success('Service order created! Funds are in escrow.');
      return tx;
    } catch (error: any) {
      console.error('Error creating service order:', error);
      
      if (error.message?.includes('User rejected')) {
        toast.error('Transaction was cancelled');
      } else {
        toast.error(`Failed to create service order: ${error.message}`);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, [program, programId, publicKey, connected]);

  // Release Service Order
  const releaseServiceOrder = useCallback(async (
    escrow: PublicKey,
    marketplace: PublicKey,
    listing: PublicKey,
    sellerAta: PublicKey,
    treasuryAta: PublicKey,
    vault: PublicKey
  ) => {
    try {
      if (!connected || !publicKey) {
        throw new Error('Wallet not connected');
      }
      
      if (!program) {
        throw new Error('Program not initialized');
      }
      
      setLoading(true);
      
      const marketplaceService = new MarketplaceService(program, programId);
      const tx = await marketplaceService.releaseServiceOrder(
        escrow,
        marketplace,
        listing,
        publicKey,
        sellerAta,
        treasuryAta,
        vault
      );
      
      toast.success('Service order completed! Funds released to seller.');
      return tx;
    } catch (error: any) {
      console.error('Error releasing service order:', error);
      
      if (error.message?.includes('User rejected')) {
        toast.error('Transaction was cancelled');
      } else {
        toast.error(`Failed to release service order: ${error.message}`);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, [program, programId, publicKey, connected]);

  return {
    initMarketplace,
    registerMerchant,  // Merchant registration
    createListing,
    buyNow,
    createServiceOrder,    // Create service order
    releaseServiceOrder,   // Release service order
    getAllListings,
    getActiveListings,
    getListingsBySeller,
    getMerchant,
    getMarketplace,
    getAllMerchants,
    getMarketplaceAddress, // Helper to get marketplace PDA
    marketplaceAddress,    // Current wallet's marketplace address
    allListings,           // All listings (auto-fetched)
    fetchAllListings,      // Function to manually refresh listings
    listingsLoading,       // Loading state for listings
    loading,
    programId,
  };
};