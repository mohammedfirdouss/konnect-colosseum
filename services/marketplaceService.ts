import { PublicKey, SystemProgram } from '@solana/web3.js';
import { BN, Program } from '@coral-xyz/anchor';
// import { TOKEN_PROGRAM_ID } from '@coral-xyz/anchor/dist/cjs/utils/token';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Connection } from '@solana/web3.js';


 class MarketplaceService {
  private program: Program;
  private programId: PublicKey;
  private connection: Connection;

  constructor(program: Program, programId: PublicKey) {
    this.program = program;
    this.programId = programId;
    this.connection = program.provider.connection;
  }

  // Get marketplace PDA address
  getMarketplaceAddress(authority: PublicKey): PublicKey {
    const [marketplace] = PublicKey.findProgramAddressSync(
      [Buffer.from('marketplace'), authority.toBuffer()],
      this.programId
    );
    return marketplace;
  }

  // Check if marketplace is already initialized
  async isMarketplaceInitialized(authority: PublicKey): Promise<boolean> {
    try {
        const marketplace = this.getMarketplaceAddress(authority);
        const accountInfo = await this.program.provider.connection.getAccountInfo(marketplace);
        return accountInfo !== null;
    } catch (error) {
        console.error('Error checking marketplace initialization:', error);
        return false;
    }
  }

  // Initialize Marketplace
  async initMarketplace(authority: PublicKey, feeBps: number) {
    try {
      console.log('Initializing marketplace with authority:', authority.toString());
      console.log('Program ID:', this.programId.toString());
      console.log('Program methods available:', Object.keys(this.program.methods || {}));
      
      // Check if marketplace is already initialized
      const isInitialized = await this.isMarketplaceInitialized(authority);
      if (isInitialized) {
        console.log('Marketplace is already initialized');
        throw new Error('Marketplace is already initialized');
      }
      
      const [marketplace] = PublicKey.findProgramAddressSync(
        [Buffer.from('marketplace'), authority.toBuffer()],
        this.programId
      );

      console.log('Marketplace PDA:', marketplace.toString());

      const result = await this.program.methods
        .initMarketplace(feeBps)
        .accounts({
          marketplace,
          authority,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log('Marketplace initialization successful:', result);
      return result;
    } catch (error: any) {
      console.error('Error in initMarketplace:', error);
      
      // Provide more helpful error messages
      if (error.message?.includes('403')) {
        throw new Error('RPC endpoint access denied. Please check your network connection or try again later.');
      } else if (error.message?.includes('failed to get recent blockhash')) {
        throw new Error('Unable to connect to Solana network. Please check your internet connection.');
      } else if (error.message?.includes('insufficient funds')) {
        throw new Error('Insufficient SOL balance for transaction fees.');
      } else if (error.message?.includes('already been processed')) {
        throw new Error('Transaction already processed - marketplace may already be initialized.');
      } else if (error.message?.includes('User rejected')) {
        throw new Error('Transaction was cancelled by user.');
      } else {
        throw new Error(`Transaction failed: ${error.message || 'Unknown error'}`);
      }
    }
  }

  // Register Merchant
  async registerMerchant(marketplace: PublicKey, owner: PublicKey) {
    const [merchant] = PublicKey.findProgramAddressSync(
      [Buffer.from('merchant'), marketplace.toBuffer(), owner.toBuffer()],
      this.programId
    );

    return await this.program.methods
      .registerMerchant()
      .accounts({
        marketplace,
        merchant,
        owner,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  // Create Listing
  async createListing(
    marketplace: PublicKey,
    merchant: PublicKey,
    owner: PublicKey,
    mint: PublicKey,
    price: number,
    quantity: number,
    isService: boolean
  ) {
    try {
      console.log('Creating listing with params:', {
        marketplace: marketplace.toString(),
        merchant: merchant.toString(),
        owner: owner.toString(),
        mint: mint.toString(),
        price,
        quantity,
        isService
      });

      const [listing] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('listing'),
          marketplace.toBuffer(),
          merchant.toBuffer(),
          mint.toBuffer(),
        ],
        this.programId
      );

      console.log('Listing PDA:', listing.toString());

      // Check if listing already exists
      const existingListing = await this.connection.getAccountInfo(listing);
      if (existingListing) {
        console.log('Listing already exists at:', listing.toString());
        throw new Error('A listing with these parameters already exists. Please update the existing listing or use different parameters.');
      }

      // Build the transaction
      const transaction = await this.program.methods
        .createListing(new BN(price), quantity, isService)
        .accounts({
          marketplace,
          merchant,
          owner,
          listing,
          mint,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      // Send with explicit instructions to get a fresh signature
      const tx = await this.program.provider.sendAndConfirm(transaction, [], {
        skipPreflight: false,
        commitment: 'confirmed',
      });

      return tx;
    } catch (error: any) {
      console.error('Error in createListing:', error);
      throw error;
    }
  }

  // Buy Now (for goods)
  async buyNow(
    listing: PublicKey,
    marketplace: PublicKey,
    buyer: PublicKey,
    buyerAta: PublicKey,
    sellerAta: PublicKey,
    treasuryAta: PublicKey,
    mint: PublicKey,
    quantity: number,
    reference: PublicKey
  ) {
    return await this.program.methods
      .buyNow(quantity, reference)
      .accounts({
        listing,
        marketplace,
        buyer,
        buyerAta,
        sellerAta,
        treasuryAta,
        mint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  }

  // Create Service Order
  async createServiceOrder(
    marketplace: PublicKey,
    listing: PublicKey,
    buyer: PublicKey,
    buyerAta: PublicKey,
    mint: PublicKey,
    reference: PublicKey
  ) {
    const [escrow] = PublicKey.findProgramAddressSync(
      [Buffer.from('escrow'), listing.toBuffer(), buyer.toBuffer()],
      this.programId
    );

    const [vault] = PublicKey.findProgramAddressSync(
      [
        escrow.toBuffer(),
        Buffer.from('vault'),
        mint.toBuffer(),
      ],
      this.programId
    );

    return await this.program.methods
      .createServiceOrder(reference)
      .accounts({
        marketplace,
        listing,
        buyer,
        buyerAta,
        escrow,
        vault,
        mint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  // Release Service Order
  async releaseServiceOrder(
    escrow: PublicKey,
    marketplace: PublicKey,
    listing: PublicKey,
    buyer: PublicKey,
    sellerAta: PublicKey,
    treasuryAta: PublicKey,
    vault: PublicKey
  ) {
    return await this.program.methods
      .releaseServiceOrder()
      .accounts({
        escrow,
        marketplace,
        listing,
        buyer,
        sellerAta,
        treasuryAta,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  // Cancel Service Order
// Cancel Service Order
async cancelServiceOrder(
    escrow: PublicKey,
    marketplace: PublicKey,
    buyer: PublicKey,
    buyerAta: PublicKey,
    vault: PublicKey
  ) {
    return await this.program.methods
      .cancelServiceOrder()
      .accounts({
        escrow,
        marketplace,
        buyer,
        buyerAta,
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
  }

  // Update Listing
  async updateListing(
    listing: PublicKey,
    seller: PublicKey,
    newPrice?: number,
    newQuantity?: number,
    active?: boolean
  ) {
    return await this.program.methods
      .updateListing(
        newPrice ? new BN(newPrice) : null,
        newQuantity || null,
        active !== undefined ? active : null
      )
      .accounts({
        listing,
        seller,
      })
      .rpc();
  }

  // Get all listings for a marketplace
  async getAllListings(marketplace: PublicKey): Promise<any[]> {
    try {
      if (!this.program || !this.connection) {
        throw new Error('Program not initialized');
      }

      console.log('Fetching all listings for marketplace:', marketplace.toString());

      // Use the program's account namespace to fetch listings
      // The account namespace automatically handles deserialization
      const listings = await this.program.account.listing.all([
        {
          memcmp: {
            offset: 8, // Skip 8-byte discriminator
            bytes: marketplace.toBase58(), // Filter by marketplace address
          },
        },
      ]);

      console.log(`Found ${listings.length} listings`);

      // Transform the data to a more usable format
      const transformedListings = listings.map((item: any) => {
        return {
          address: item.publicKey.toString(),
          marketplace: item.account.marketplace.toString(),
          seller: item.account.seller.toString(),
          mint: item.account.mint.toString(),
          price: item.account.price.toNumber(),
          quantity: item.account.quantity,
          isService: item.account.isService,
          active: item.account.active,
          bump: item.account.bump,
        };
      });

      return transformedListings;
    } catch (error) {
      console.error('Error fetching listings:', error);
      throw error;
    }
  }

  // Get active listings only
  async getActiveListings(marketplace: PublicKey): Promise<any[]> {
    try {
      if (!this.program || !this.connection) {
        throw new Error('Program not initialized');
      }

      console.log('Fetching active listings for marketplace:', marketplace.toString());

      // Fetch all listings for this marketplace
      const allListings = await this.program.account.listing.all([
        {
          memcmp: {
            offset: 8, // Skip discriminator
            bytes: marketplace.toBase58(),
          },
        },
      ]);

      // Filter to only active listings
      const activeListings = allListings.filter((item: any) => item.account.active);

      console.log(`Found ${activeListings.length} active listings`);

      // Transform the data
      const transformedListings = activeListings.map((item: any) => {
        return {
          address: item.publicKey.toString(),
          marketplace: item.account.marketplace.toString(),
          seller: item.account.seller.toString(),
          mint: item.account.mint.toString(),
          price: item.account.price.toNumber(),
          quantity: item.account.quantity,
          isService: item.account.isService,
          active: item.account.active,
          bump: item.account.bump,
        };
      });

      return transformedListings;
    } catch (error) {
      console.error('Error fetching active listings:', error);
      throw error;
    }
  }

  // Get listings by seller
  async getListingsBySeller(marketplace: PublicKey, seller: PublicKey): Promise<any[]> {
    try {
      if (!this.program || !this.connection) {
        throw new Error('Program not initialized');
      }

      // For now, return empty array since we need proper account deserialization
      console.log('getListingsBySeller called for seller:', seller.toString());
      return [];
    } catch (error) {
      console.error('Error fetching seller listings:', error);
      throw error;
    }
  }

  // Get merchant information
  async getMerchant(marketplace: PublicKey, owner: PublicKey): Promise<any | null> {
    try {
      if (!this.program || !this.connection) {
        throw new Error('Program not initialized');
      }

      const [merchantPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('merchant'), marketplace.toBuffer(), owner.toBuffer()],
        this.programId
      );
      
      // Use connection to fetch account data directly
      const accountInfo = await this.connection.getAccountInfo(merchantPDA);
      if (!accountInfo) {
        return null;
      }

      return {
        address: merchantPDA,
        // Add other fields as needed
      };
    } catch (error) {
      console.error('Error fetching merchant:', error);
      return null;
    }
  }

  // Get marketplace information
  async getMarketplace(authority: PublicKey): Promise<any | null> {
    try {
      if (!this.program || !this.connection) {
        throw new Error('Program not initialized');
      }

      const [marketplacePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('marketplace'), authority.toBuffer()],
        this.programId
      );
      
      // Use connection to fetch account data directly
      const accountInfo = await this.connection.getAccountInfo(marketplacePDA);
      if (!accountInfo) {
        return null;
      }

      return {
        address: marketplacePDA,
        // Add other fields as needed
      };
    } catch (error) {
      console.error('Error fetching marketplace:', error);
      return null;
    }
  }

  // Get all merchants for a marketplace
  async getAllMerchants(marketplace: PublicKey): Promise<any[]> {
    try {
      if (!this.program || !this.connection) {
        throw new Error('Program not initialized');
      }

      // Use connection to get program accounts directly
      const accounts = await this.connection.getProgramAccounts(this.programId, {
        filters: [
          {
            memcmp: {
              offset: 8, // Skip discriminator
              bytes: marketplace.toBase58(),
            },
          },
        ],
      });

      // Parse merchant accounts (simplified)
      const merchants = accounts.map(account => ({
        address: account.pubkey,
        marketplace: marketplace,
        // Add other fields as needed
      }));

      return merchants;
    } catch (error) {
      console.error('Error fetching merchants:', error);
      throw error;
    }
  }
}


 export default MarketplaceService