import {
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { BN, Program } from "@coral-xyz/anchor";
// import { TOKEN_PROGRAM_ID } from '@coral-xyz/anchor/dist/cjs/utils/token';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  NATIVE_MINT,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection } from "@solana/web3.js";

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
      [Buffer.from("marketplace"), authority.toBuffer()],
      this.programId
    );
    return marketplace;
  }

  // Check if marketplace is already initialized
  async isMarketplaceInitialized(authority: PublicKey): Promise<boolean> {
    try {
      const marketplace = this.getMarketplaceAddress(authority);
      const accountInfo = await this.program.provider.connection.getAccountInfo(
        marketplace
      );
      return accountInfo !== null;
    } catch (error) {
      console.error("Error checking marketplace initialization:", error);
      return false;
    }
  }

  // Initialize Marketplace
  async initMarketplace(authority: PublicKey, feeBps: number) {
    try {
      console.log(
        "Initializing marketplace with authority:",
        authority.toString()
      );
      console.log("Program ID:", this.programId.toString());
      console.log(
        "Program methods available:",
        Object.keys(this.program.methods || {})
      );

      // Check if marketplace is already initialized
      const isInitialized = await this.isMarketplaceInitialized(authority);
      if (isInitialized) {
        console.log("Marketplace is already initialized");
        throw new Error("Marketplace is already initialized");
      }

      const [marketplace] = PublicKey.findProgramAddressSync(
        [Buffer.from("marketplace"), authority.toBuffer()],
        this.programId
      );

      console.log("Marketplace PDA:", marketplace.toString());

      const result = await this.program.methods
        .initMarketplace(feeBps)
        .accounts({
          marketplace,
          authority,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Marketplace initialization successful:", result);
      return result;
    } catch (error: any) {
      console.error("Error in initMarketplace:", error);

      // Provide more helpful error messages
      if (error.message?.includes("403")) {
        throw new Error(
          "RPC endpoint access denied. Please check your network connection or try again later."
        );
      } else if (error.message?.includes("failed to get recent blockhash")) {
        throw new Error(
          "Unable to connect to Solana network. Please check your internet connection."
        );
      } else if (error.message?.includes("insufficient funds")) {
        throw new Error("Insufficient SOL balance for transaction fees.");
      } else if (error.message?.includes("already been processed")) {
        throw new Error(
          "Transaction already processed - marketplace may already be initialized."
        );
      } else if (error.message?.includes("User rejected")) {
        throw new Error("Transaction was cancelled by user.");
      } else {
        throw new Error(
          `Transaction failed: ${error.message || "Unknown error"}`
        );
      }
    }
  }

  // Register Merchant
  async registerMerchant(marketplace: PublicKey, owner: PublicKey) {
    const [merchant] = PublicKey.findProgramAddressSync(
      [Buffer.from("merchant"), marketplace.toBuffer(), owner.toBuffer()],
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
    isService: boolean,
    name: string,
    imageUrl: string
  ) {
    try {
      console.log("Creating listing with params:", {
        marketplace: marketplace.toString(),
        merchant: merchant.toString(),
        owner: owner.toString(),
        mint: mint.toString(),
        price,
        quantity,
        isService,
        name,
        imageUrl,
      });

      // First, get the merchant account to access next_nonce
      const merchantAccountInfo = await this.connection.getAccountInfo(
        merchant
      );
      if (!merchantAccountInfo) {
        throw new Error("Merchant account not found");
      }

      // Decode the merchant account data manually
      // The next_nonce is at offset 8 + 32 + 32 + 1 + 1 = 74 bytes (discriminator + marketplace + owner + verified + bump)
      const merchantData = merchantAccountInfo.data;
      const nextNonceBytes = merchantData.slice(74, 82); // u64 is 8 bytes
      const readView = new DataView(
        nextNonceBytes.buffer,
        nextNonceBytes.byteOffset
      );
      const nextNonce = readView.getBigUint64(0, true); // true for little-endian

      console.log("Merchant next_nonce:", nextNonce.toString());

      // Generate listing PDA using correct seeds: ['listing', merchant, next_nonce]
      // Convert u64 next_nonce to 8-byte buffer (little-endian)
      const nonceBuffer = new Uint8Array(8);
      const writeView = new DataView(nonceBuffer.buffer);
      writeView.setBigUint64(0, nextNonce, true); // true for little-endian

      const [listing] = PublicKey.findProgramAddressSync(
        [Buffer.from("listing"), merchant.toBuffer(), Buffer.from(nonceBuffer)],
        this.programId
      );

      console.log("Listing PDA:", listing.toString());

      // Check if listing already exists
      const existingListing = await this.connection.getAccountInfo(listing);
      if (existingListing) {
        console.log("Listing already exists at:", listing.toString());
        throw new Error(
          "A listing with these parameters already exists. Please update the existing listing or use different parameters."
        );
      }

      // Build the transaction
      const transaction = await this.program.methods
        .createListing(new BN(price), quantity, isService, name, imageUrl)
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
      const tx = await this.program.provider.sendAndConfirm!(transaction, [], {
        skipPreflight: false,
        commitment: "confirmed",
      });

      return tx;
    } catch (error: any) {
      console.error("Error in createListing:", error);
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
    try {
      console.log("Creating buyNow transaction with accounts:", {
        listing: listing.toString(),
        marketplace: marketplace.toString(),
        buyer: buyer.toString(),
        buyerAta: buyerAta.toString(),
        sellerAta: sellerAta.toString(),
        treasuryAta: treasuryAta.toString(),
        mint: mint.toString(),
        quantity,
        reference: reference.toString(),
      });

      // Create the main transaction
      const transaction = await this.program.methods
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
        .remainingAccounts([
          {
            pubkey: reference,
            isSigner: false,
            isWritable: false,
          },
        ])
        .transaction();

      // Check if ATAs exist and add creation instructions if needed
      const instructions = [];

      // Check buyer ATA - more comprehensive check
      console.log("Checking buyer ATA:", buyerAta.toString());
      console.log("Mint address:", mint.toString());
      console.log("Buyer address:", buyer.toString());

      const buyerAtaInfo = await this.connection.getAccountInfo(buyerAta);
      console.log("Buyer ATA account info:", buyerAtaInfo ? "exists" : "null");

      // Check if this is native SOL
      const isNativeSOL = mint.equals(NATIVE_MINT);
      console.log("Is native SOL:", isNativeSOL);

      if (!buyerAtaInfo) {
        console.log("Buyer ATA does not exist, creating:", buyerAta.toString());

        const createBuyerAtaIx = createAssociatedTokenAccountInstruction(
          buyer, // payer
          buyerAta, // ata
          buyer, // owner
          mint // mint
        );
        instructions.push(createBuyerAtaIx);
        console.log("Added buyer ATA creation instruction");
      } else {
        console.log("Buyer ATA already exists:", buyerAta.toString());
      }

      // For native SOL, add transfer + sync instructions to wrap SOL
      if (isNativeSOL) {
        console.log("Adding SOL wrapping instructions");

        // Wrap a reasonable amount (quantity * estimated price with buffer)
        // This is a safe estimate to cover the purchase + fees
        const estimatedAmount = quantity * 1000000000; // 1 SOL per item as safe estimate

        console.log("Wrapping amount:", estimatedAmount, "lamports");

        // Transfer SOL to the ATA
        const transferIx = SystemProgram.transfer({
          fromPubkey: buyer,
          toPubkey: buyerAta,
          lamports: estimatedAmount,
        });
        instructions.push(transferIx);

        // Sync native to convert SOL to wrapped SOL
        const syncIx = createSyncNativeInstruction(buyerAta);
        instructions.push(syncIx);

        console.log("Added SOL wrapping instructions (transfer + sync)");
      }

      // For now, let's focus on the buyer ATA which is the main issue
      // The seller and treasury ATAs might be handled by the program or already exist
      console.log(
        "ATA creation check completed. Instructions to add:",
        instructions.length
      );

      // Add ATA creation instructions before the main transaction
      if (instructions.length > 0) {
        transaction.instructions.unshift(...instructions);
        console.log(`Added ${instructions.length} ATA creation instructions`);
        console.log(
          "Transaction now has",
          transaction.instructions.length,
          "total instructions"
        );
      } else {
        console.log("No ATA creation instructions needed");
        console.log(
          "Transaction has",
          transaction.instructions.length,
          "instructions"
        );
      }

      // Log all accounts being used in the transaction
      console.log("\n=== BUY NOW ACCOUNTS ===");
      console.log("Listing:", listing.toString());
      console.log("Marketplace:", marketplace.toString());
      console.log("Buyer:", buyer.toString());
      console.log("Buyer ATA:", buyerAta.toString());
      console.log("Seller ATA:", sellerAta.toString());
      console.log("Treasury ATA:", treasuryAta.toString());
      console.log("Mint:", mint.toString());
      console.log("Quantity:", quantity);
      console.log("Reference:", reference.toString());
      console.log("Total Instructions:", transaction.instructions.length);

      // Log transaction details before sending
      console.log("\nTransaction Instructions:");
      transaction.instructions.forEach((ix, index) => {
        console.log(`  ${index}:`, ix.programId.toString());
      });
      console.log("========================\n");

      // Send the transaction
      console.log("Sending buyNow transaction...");
      const result = await this.program.provider.sendAndConfirm!(transaction);
      console.log("BuyNow transaction successful:", result);
      return result;
    } catch (error: any) {
      console.error("Error in buyNow:", error);
      throw error;
    }
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
    try {
      console.log("Creating service order with accounts:", {
        marketplace: marketplace.toString(),
        listing: listing.toString(),
        buyer: buyer.toString(),
        buyerAta: buyerAta.toString(),
        mint: mint.toString(),
        reference: reference.toString(),
      });

      const [escrow] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), listing.toBuffer(), buyer.toBuffer()],
        this.programId
      );

      // The vault is actually an ATA owned by the escrow
      // Use getAssociatedTokenAddressSync instead of findProgramAddressSync
      const vault = getAssociatedTokenAddressSync(
        mint,
        escrow,
        true // allowOwnerOffCurve - escrow is a PDA
      );

      console.log("Derived accounts:", {
        escrow: escrow.toString(),
        vault: vault.toString(),
      });

      // Create the main transaction
      const transaction = await this.program.methods
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
        .remainingAccounts([
          {
            pubkey: reference,
            isSigner: false,
            isWritable: false,
          },
        ])
        .transaction();

      // Check if buyer ATA exists and add creation instruction if needed
      const instructions = [];

      // Check if this is native SOL
      const isNativeSOL = mint.equals(NATIVE_MINT);
      console.log("Is native SOL (service order):", isNativeSOL);

      const buyerAtaInfo = await this.connection.getAccountInfo(buyerAta);
      if (!buyerAtaInfo) {
        console.log(
          "Buyer ATA does not exist for service order, creating:",
          buyerAta.toString()
        );
        const createBuyerAtaIx = createAssociatedTokenAccountInstruction(
          buyer, // payer
          buyerAta, // ata
          buyer, // owner
          mint // mint
        );
        instructions.push(createBuyerAtaIx);
        console.log("Added buyer ATA creation instruction for service order");
      } else {
        console.log(
          "Buyer ATA already exists for service order:",
          buyerAta.toString()
        );
      }

      // Note: The vault is a PDA created by the smart contract, not a standard ATA
      // We don't need to create it manually - the program will initialize it
      console.log(
        "Vault PDA will be initialized by the program:",
        vault.toString()
      );

      // For native SOL, add transfer + sync instructions to wrap SOL
      if (isNativeSOL) {
        console.log("Adding SOL wrapping instructions for service order");

        // Wrap a reasonable amount (1 SOL as safe estimate to cover service + fees)
        const estimatedAmount = 1000000000; // 1 SOL

        console.log(
          "Wrapping amount for service:",
          estimatedAmount,
          "lamports"
        );

        // Transfer SOL to the ATA
        const transferIx = SystemProgram.transfer({
          fromPubkey: buyer,
          toPubkey: buyerAta,
          lamports: estimatedAmount,
        });
        instructions.push(transferIx);

        // Sync native to convert SOL to wrapped SOL
        const syncIx = createSyncNativeInstruction(buyerAta);
        instructions.push(syncIx);

        console.log(
          "Added SOL wrapping instructions for service order (transfer + sync)"
        );
      }

      // Add ATA creation instructions before the main transaction
      if (instructions.length > 0) {
        transaction.instructions.unshift(...instructions);
        console.log(
          `Added ${instructions.length} ATA creation instructions for service order`
        );
      }

      // Log all accounts being used in the transaction
      console.log("\n=== CREATE SERVICE ORDER ACCOUNTS ===");
      console.log("Marketplace:", marketplace.toString());
      console.log("Listing:", listing.toString());
      console.log("Buyer:", buyer.toString());
      console.log("Buyer ATA:", buyerAta.toString());
      console.log("Escrow PDA:", escrow.toString());
      console.log("Vault ATA:", vault.toString());
      console.log("Mint:", mint.toString());
      console.log("Reference:", reference.toString());
      console.log("Total Instructions:", transaction.instructions.length);
      console.log("=====================================\n");

      // Send the transaction
      console.log("Sending createServiceOrder transaction...");
      const result = await this.program.provider.sendAndConfirm!(transaction);
      console.log("CreateServiceOrder transaction successful:", result);
      return result;
    } catch (error: any) {
      console.error("Error in createServiceOrder:", error);
      throw error;
    }
  }

  // Create Goods Order with Escrow
  async createGoodsOrderWithEscrow(
    marketplace: PublicKey,
    listing: PublicKey,
    buyer: PublicKey,
    buyerAta: PublicKey,
    mint: PublicKey,
    quantity: number,
    reference: PublicKey
  ) {
    try {
      console.log("\n===== Create Goods Order with Escrow =====");
      console.log("Marketplace:", marketplace.toString());
      console.log("Listing:", listing.toString());
      console.log("Buyer:", buyer.toString());
      console.log("Buyer ATA:", buyerAta.toString());
      console.log("Mint:", mint.toString());
      console.log("Quantity:", quantity);
      console.log("Reference:", reference.toString());

      const [escrow] = PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), listing.toBuffer(), buyer.toBuffer()],
        this.programId
      );

      // The vault is an ATA owned by the escrow PDA
      const vault = getAssociatedTokenAddressSync(
        mint,
        escrow,
        true // allowOwnerOffCurve - escrow is a PDA
      );

      console.log("Derived accounts:", {
        escrow: escrow.toString(),
        vault: vault.toString(),
      });

      // Create the main transaction
      const transaction = await this.program.methods
        .createGoodsOrderWithEscrow(quantity, reference)
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
        .remainingAccounts([
          {
            pubkey: reference,
            isSigner: false,
            isWritable: false,
          },
        ])
        .transaction();

      // Check if buyer ATA exists and add creation instruction if needed
      const instructions = [];

      // Check if this is native SOL
      const isNativeSOL = mint.equals(NATIVE_MINT);
      console.log("Is native SOL (goods order):", isNativeSOL);

      const buyerAtaInfo = await this.connection.getAccountInfo(buyerAta);
      if (!buyerAtaInfo) {
        console.log(
          "Buyer ATA does not exist for goods order, creating:",
          buyerAta.toString()
        );
        const createBuyerAtaIx = createAssociatedTokenAccountInstruction(
          buyer, // payer
          buyerAta, // ata
          buyer, // owner
          mint // mint
        );
        instructions.push(createBuyerAtaIx);
        console.log("Added buyer ATA creation instruction for goods order");
      } else {
        console.log(
          "Buyer ATA already exists for goods order:",
          buyerAta.toString()
        );
      }

      // For native SOL, add transfer + sync instructions to wrap SOL
      if (isNativeSOL) {
        console.log("Adding SOL wrapping instructions for goods order");

        // Wrap a reasonable amount (1 SOL as safe estimate to cover goods + fees)
        const estimatedAmount = 1000000000; // 1 SOL

        console.log("Wrapping amount for goods:", estimatedAmount, "lamports");

        // Transfer SOL to the ATA
        const transferIx = SystemProgram.transfer({
          fromPubkey: buyer,
          toPubkey: buyerAta,
          lamports: estimatedAmount,
        });
        instructions.push(transferIx);

        // Sync native (wrap the SOL)
        const syncIx = createSyncNativeInstruction(buyerAta);
        instructions.push(syncIx);

        console.log("Added transfer and sync instructions for goods order");
      }

      // Add all instructions to the transaction
      if (instructions.length > 0) {
        transaction.instructions.unshift(...instructions);
        console.log(
          `Added ${instructions.length} pre-instructions for goods order`
        );
      }

      // Log transaction summary
      console.log("\n===== Goods Order Transaction Summary =====");
      console.log("Escrow:", escrow.toString());
      console.log("Vault:", vault.toString());
      console.log("Marketplace:", marketplace.toString());
      console.log("Listing:", listing.toString());
      console.log("Buyer:", buyer.toString());
      console.log("Buyer ATA:", buyerAta.toString());
      console.log("Mint:", mint.toString());
      console.log("Quantity:", quantity);
      console.log("Reference:", reference.toString());
      console.log("Total Instructions:", transaction.instructions.length);
      console.log("=====================================\n");

      // Send the transaction
      console.log("Sending createGoodsOrderWithEscrow transaction...");
      const result = await this.program.provider.sendAndConfirm!(transaction);
      console.log("CreateGoodsOrderWithEscrow transaction successful:", result);
      return result;
    } catch (error: any) {
      console.error("Error in createGoodsOrderWithEscrow:", error);
      throw error;
    }
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
        throw new Error("Program not initialized");
      }

      console.log(
        "Fetching all listings for marketplace:",
        marketplace.toString()
      );

      // Use the program's account namespace to fetch listings
      // The account namespace automatically handles deserialization
      const listings = await(this.program.account as any).listing.all([
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
      console.error("Error fetching listings:", error);
      throw error;
    }
  }

  // Get active listings only
  async getActiveListings(marketplace: PublicKey): Promise<any[]> {
    try {
      if (!this.program || !this.connection) {
        throw new Error("Program not initialized");
      }

      console.log(
        "Fetching active listings for marketplace:",
        marketplace.toString()
      );

      // Fetch all listings for this marketplace
      const allListings = await(this.program.account as any).listing.all([
        {
          memcmp: {
            offset: 8, // Skip discriminator
            bytes: marketplace.toBase58(),
          },
        },
      ]);

      // Filter to only active listings
      const activeListings = allListings.filter(
        (item: any) => item.account.active
      );

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
      console.error("Error fetching active listings:", error);
      throw error;
    }
  }

  // Get listings by seller
  async getListingsBySeller(
    marketplace: PublicKey,
    seller: PublicKey
  ): Promise<any[]> {
    try {
      if (!this.program || !this.connection) {
        throw new Error("Program not initialized");
      }

      // For now, return empty array since we need proper account deserialization
      console.log("getListingsBySeller called for seller:", seller.toString());
      return [];
    } catch (error) {
      console.error("Error fetching seller listings:", error);
      throw error;
    }
  }

  // Get merchant information
  async getMerchant(
    marketplace: PublicKey,
    owner: PublicKey
  ): Promise<any | null> {
    try {
      if (!this.program || !this.connection) {
        throw new Error("Program not initialized");
      }

      const [merchantPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("merchant"), marketplace.toBuffer(), owner.toBuffer()],
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
      console.error("Error fetching merchant:", error);
      return null;
    }
  }

  // Get marketplace information
  async getMarketplace(authority: PublicKey): Promise<any | null> {
    try {
      if (!this.program || !this.connection) {
        throw new Error("Program not initialized");
      }

      const [marketplacePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("marketplace"), authority.toBuffer()],
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
      console.error("Error fetching marketplace:", error);
      return null;
    }
  }

  // Get all merchants for a marketplace
  async getAllMerchants(marketplace: PublicKey): Promise<any[]> {
    try {
      if (!this.program || !this.connection) {
        throw new Error("Program not initialized");
      }

      // Use connection to get program accounts directly
      const accounts = await this.connection.getProgramAccounts(
        this.programId,
        {
          filters: [
            {
              memcmp: {
                offset: 8, // Skip discriminator
                bytes: marketplace.toBase58(),
              },
            },
          ],
        }
      );

      // Parse merchant accounts (simplified)
      const merchants = accounts.map((account) => ({
        address: account.pubkey,
        marketplace: marketplace,
        // Add other fields as needed
      }));

      return merchants;
    } catch (error) {
      console.error("Error fetching merchants:", error);
      throw error;
    }
  }

  // Get buyer's ongoing orders (unreleased escrows)
  async getBuyerOngoingOrders(buyer: PublicKey): Promise<any[]> {
    try {
      if (!this.program || !this.connection) {
        throw new Error("Program not initialized");
      }

      console.log("Fetching ongoing orders for buyer:", buyer.toString());

      // Fetch all escrow accounts for this buyer
      const escrows = await (this.program.account as any).escrow.all([
        {
          memcmp: {
            offset: 8 + 32 + 32 + 32, // Skip discriminator (8) + marketplace (32) + listing (32) + seller (32)
            bytes: buyer.toBase58(), // Filter by buyer
          },
        },
      ]);

      // Filter to only unreleased escrows
      const ongoingOrders = escrows.filter(
        (escrow: any) => !escrow.account.released
      );

      console.log(`Found ${ongoingOrders.length} ongoing orders`);

      // Transform the data and fetch listing details
      const transformedOrders = await Promise.all(
        ongoingOrders.map(async (item: any) => {
          // Fetch the listing details
          let listingDetails = null;
          try {
            const listingAccount = await (
              this.program.account as any
            ).listing.fetch(item.account.listing);
            listingDetails = listingAccount;
          } catch (error) {
            console.error("Error fetching listing for escrow:", error);
          }

          return {
            escrowAddress: item.publicKey.toString(),
            marketplace: item.account.marketplace.toString(),
            listing: item.account.listing.toString(),
            seller: item.account.seller.toString(),
            buyer: item.account.buyer.toString(),
            mint: item.account.mint.toString(),
            amount: item.account.amount.toNumber(),
            reference: item.account.reference.toString(),
            released: item.account.released,
            bump: item.account.bump,
            // Add listing details if available
            listingDetails: listingDetails
              ? {
                  name: listingDetails.name || "Unknown Item",
                  imageUrl: listingDetails.imageUrl || "",
                  price: listingDetails.price.toNumber(),
                  isService: listingDetails.isService,
                }
              : null,
          };
        })
      );

      return transformedOrders;
    } catch (error) {
      console.error("Error fetching buyer ongoing orders:", error);
      throw error;
    }
  }

  // Get buyer's completed orders (released escrows)
  async getBuyerCompletedOrders(buyer: PublicKey): Promise<any[]> {
    try {
      if (!this.program || !this.connection) {
        throw new Error("Program not initialized");
      }

      console.log("Fetching completed orders for buyer:", buyer.toString());

      // Fetch all escrow accounts for this buyer
      const escrows = await (this.program.account as any).escrow.all([
        {
          memcmp: {
            offset: 8 + 32 + 32 + 32, // Skip discriminator (8) + marketplace (32) + listing (32) + seller (32)
            bytes: buyer.toBase58(), // Filter by buyer
          },
        },
      ]);

      // Filter to only released escrows
      const completedOrders = escrows.filter(
        (escrow: any) => escrow.account.released
      );

      console.log(`Found ${completedOrders.length} completed orders`);

      // Transform the data and fetch listing details
      const transformedOrders = await Promise.all(
        completedOrders.map(async (item: any) => {
          // Fetch the listing details
          let listingDetails = null;
          try {
            const listingAccount = await (
              this.program.account as any
            ).listing.fetch(item.account.listing);
            listingDetails = listingAccount;
          } catch (error) {
            console.error("Error fetching listing for escrow:", error);
          }

          return {
            escrowAddress: item.publicKey.toString(),
            marketplace: item.account.marketplace.toString(),
            listing: item.account.listing.toString(),
            seller: item.account.seller.toString(),
            buyer: item.account.buyer.toString(),
            mint: item.account.mint.toString(),
            amount: item.account.amount.toNumber(),
            reference: item.account.reference.toString(),
            released: item.account.released,
            bump: item.account.bump,
            // Add listing details if available
            listingDetails: listingDetails
              ? {
                  name: listingDetails.name || "Unknown Item",
                  imageUrl: listingDetails.imageUrl || "",
                  price: listingDetails.price.toNumber(),
                  isService: listingDetails.isService,
                }
              : null,
          };
        })
      );

      return transformedOrders;
    } catch (error) {
      console.error("Error fetching buyer completed orders:", error);
      throw error;
    }
  }

  // Get seller's pending orders (unreleased escrows where they are the seller)
  async getSellerPendingOrders(seller: PublicKey): Promise<any[]> {
    try {
      if (!this.program || !this.connection) {
        throw new Error("Program not initialized");
      }

      console.log("Fetching pending orders for seller:", seller.toString());

      // Fetch all escrow accounts where this address is the seller
      const escrows = await (this.program.account as any).escrow.all([
        {
          memcmp: {
            offset: 8 + 32 + 32, // Skip discriminator (8) + marketplace (32) + listing (32)
            bytes: seller.toBase58(), // Filter by seller
          },
        },
      ]);

      // Filter to only unreleased escrows
      const pendingOrders = escrows.filter(
        (escrow: any) => !escrow.account.released
      );

      console.log(`Found ${pendingOrders.length} pending orders for seller`);

      // Transform the data and fetch listing details
      const transformedOrders = await Promise.all(
        pendingOrders.map(async (item: any) => {
          try {
            // Fetch the listing details
            let listingDetails = null;
            try {
              const listingAccount = await (
                this.program.account as any
              ).listing.fetch(item.account.listing);
              listingDetails = listingAccount;
            } catch (error) {
              console.error("Error fetching listing for escrow:", error);
            }

            return {
              escrowAddress: item.publicKey.toString(),
              marketplace: item.account.marketplace.toString(),
              listing: item.account.listing.toString(),
              seller: item.account.seller.toString(),
              buyer: item.account.buyer.toString(),
              mint: item.account.mint.toString(),
              amount: item.account.amount.toNumber(),
              reference: item.account.reference.toString(),
              released: item.account.released,
              bump: item.account.bump,
              // Add listing details if available
              listingDetails: listingDetails
                ? {
                    name: listingDetails.name || "Unknown Item",
                    imageUrl: listingDetails.imageUrl || "",
                    price: listingDetails.price.toNumber(),
                    isService: listingDetails.isService,
                  }
                : null,
            };
          } catch (error) {
            console.error("Error transforming escrow:", error);
            return null; // Return null for invalid escrows
          }
        })
      );

      // Filter out any null entries from failed transformations
      const validOrders = transformedOrders.filter((order) => order !== null);
      console.log(`Returning ${validOrders.length} valid pending orders`);
      return validOrders;
    } catch (error) {
      console.error("Error fetching seller pending orders:", error);
      throw error;
    }
  }

  // Get seller's ongoing orders (same as pending - unreleased escrows where they are the seller)
  async getSellerOngoingOrders(seller: PublicKey): Promise<any[]> {
    try {
      if (!this.program || !this.connection) {
        throw new Error("Program not initialized");
      }

      console.log("Fetching ongoing orders for seller:", seller.toString());

      // First, let's fetch ALL escrows to see what exists
      let allEscrows = [];
      try {
        allEscrows = await (this.program.account as any).escrow.all();
        console.log(`Total escrows in program: ${allEscrows.length}`);

        // Log all escrows for debugging
        allEscrows.forEach((escrow: any, index: number) => {
          try {
            console.log(`Escrow ${index}:`, {
              address: escrow.publicKey.toString(),
              seller: escrow.account.seller.toString(),
              buyer: escrow.account.buyer.toString(),
              amount: escrow.account.amount.toString(),
              released: escrow.account.released,
            });
          } catch (error) {
            console.log(`Escrow ${index}: Error parsing escrow data`, error);
          }
        });
      } catch (error) {
        console.log("Error fetching all escrows:", error);
      }

      // Fetch all escrow accounts where this address is the seller
      const escrows = await (this.program.account as any).escrow.all([
        {
          memcmp: {
            offset: 8 + 32 + 32, // Skip discriminator (8) + marketplace (32) + listing (32)
            bytes: seller.toBase58(), // Filter by seller
          },
        },
      ]);

      console.log(`Escrows where wallet is seller: ${escrows.length}`);

      // Filter to only unreleased escrows (ongoing orders)
      const ongoingOrders = escrows.filter(
        (escrow: any) => !escrow.account.released
      );

      console.log(`Found ${ongoingOrders.length} ongoing orders for seller`);

      // Transform the data and fetch listing details
      const transformedOrders = await Promise.all(
        ongoingOrders.map(async (item: any) => {
          try {
            // Fetch the listing details
            let listingDetails = null;
            try {
              const listingAccount = await (
                this.program.account as any
              ).listing.fetch(item.account.listing);
              listingDetails = listingAccount;
            } catch (error) {
              console.error("Error fetching listing for escrow:", error);
            }

            return {
              escrowAddress: item.publicKey.toString(),
              marketplace: item.account.marketplace.toString(),
              listing: item.account.listing.toString(),
              seller: item.account.seller.toString(),
              buyer: item.account.buyer.toString(),
              mint: item.account.mint.toString(),
              amount: item.account.amount.toNumber(),
              reference: item.account.reference.toString(),
              released: item.account.released,
              bump: item.account.bump,
              // Add listing details if available
              listingDetails: listingDetails
                ? {
                    name: listingDetails.name || "Unknown Item",
                    imageUrl: listingDetails.imageUrl || "",
                    price: listingDetails.price.toNumber(),
                    isService: listingDetails.isService,
                  }
                : null,
            };
          } catch (error) {
            console.error("Error transforming escrow:", error);
            return null; // Return null for invalid escrows
          }
        })
      );

      // Filter out any null entries from failed transformations
      const validOrders = transformedOrders.filter((order) => order !== null);
      console.log(`Returning ${validOrders.length} valid ongoing orders`);
      return validOrders;
    } catch (error) {
      console.error("Error fetching seller ongoing orders:", error);
      throw error;
    }
  }

  // Get seller's completed orders (released escrows where they are the seller)
  async getSellerCompletedOrders(seller: PublicKey): Promise<any[]> {
    try {
      if (!this.program || !this.connection) {
        throw new Error("Program not initialized");
      }

      console.log("Fetching completed orders for seller:", seller.toString());

      // Fetch all escrow accounts where this address is the seller
      const escrows = await (this.program.account as any).escrow.all([
        {
          memcmp: {
            offset: 8 + 32 + 32, // Skip discriminator (8) + marketplace (32) + listing (32)
            bytes: seller.toBase58(), // Filter by seller
          },
        },
      ]);

      console.log(
        `Escrows where wallet is seller (for completed): ${escrows.length}`
      );

      // Filter to only released escrows (completed orders)
      const completedOrders = escrows.filter(
        (escrow: any) => escrow.account.released
      );

      console.log(
        `Found ${completedOrders.length} completed orders for seller`
      );

      // Transform the data and fetch listing details
      const transformedOrders = await Promise.all(
        completedOrders.map(async (item: any) => {
          try {
            // Fetch the listing details
            let listingDetails = null;
            try {
              const listingAccount = await (
                this.program.account as any
              ).listing.fetch(item.account.listing);
              listingDetails = listingAccount;
            } catch (error) {
              console.error("Error fetching listing for escrow:", error);
            }

            return {
              escrowAddress: item.publicKey.toString(),
              marketplace: item.account.marketplace.toString(),
              listing: item.account.listing.toString(),
              seller: item.account.seller.toString(),
              buyer: item.account.buyer.toString(),
              mint: item.account.mint.toString(),
              amount: item.account.amount.toNumber(),
              reference: item.account.reference.toString(),
              released: item.account.released,
              bump: item.account.bump,
              // Add listing details if available
              listingDetails: listingDetails
                ? {
                    name: listingDetails.name || "Unknown Item",
                    imageUrl: listingDetails.imageUrl || "",
                    price: listingDetails.price.toNumber(),
                    isService: listingDetails.isService,
                  }
                : null,
            };
          } catch (error) {
            console.error("Error transforming escrow:", error);
            return null; // Return null for invalid escrows
          }
        })
      );

      // Filter out any null entries from failed transformations
      const validOrders = transformedOrders.filter((order) => order !== null);
      console.log(`Returning ${validOrders.length} valid completed orders`);
      return validOrders;
    } catch (error) {
      console.error("Error fetching seller completed orders:", error);
      throw error;
    }
  }
}

export default MarketplaceService;
