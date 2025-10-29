import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Konnect } from "../target/types/konnect";
import { PublicKey, Keypair } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  createMint,
  mintTo,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
  createSyncNativeInstruction,
} from "@solana/spl-token";
import { readFileSync } from "fs";

async function main() {
  let walletKeypair: Keypair;
  let idl: any;

  try {
    const keypairData = readFileSync("demo-keypair.json", "utf-8");
    walletKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(keypairData)));
    console.log("Loaded demo-keypair.json");
  } catch {
    const keypairPath = require("os").homedir() + "/.config/solana/id.json";
    const keypairData = JSON.parse(readFileSync(keypairPath, "utf-8"));
    walletKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));
    console.log("Using default Solana wallet");
  }

  const wallet = new anchor.Wallet(walletKeypair);
  const connection = new anchor.web3.Connection("https://api.devnet.solana.com", "confirmed");
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  // Load IDL
  const idlPath = "../target/idl/konnect.json";
  idl = JSON.parse(readFileSync(idlPath, "utf-8"));

  const programId = new PublicKey("mbLjS3jLDX74Ptza9EiiG4qcPPE9aPS7EzifCLZc5hJ");
  const program = new Program(idl, provider) as Program<Konnect>;

  console.log(`Program ID: ${program.programId.toString()}`);
  console.log(`Wallet: ${wallet.publicKey.toString()}`);
  console.log(`Balance: ${await connection.getBalance(wallet.publicKey) / 1e9} SOL\n`);

  const balance = await connection.getBalance(wallet.publicKey);
  if (balance < 0.1 * 1e9) {
    console.log("balance is less than 0.1 SOL, request airdrop:");
    console.log(`solana airdrop 2 ${wallet.publicKey.toString()}`);
    process.exit(1);
  }

  //initialize marketplace
  const [marketplacePda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("marketplace"), wallet.publicKey.toBuffer()],
    program.programId
  );
  console.log(`Marketplace PDA: ${marketplacePda.toString()}`);

  try {
    await (program.account as any).marketplace.fetch(marketplacePda);
    console.log("Marketplace already exists\n");
  } catch {
    const tx = await program.methods
      .initMarketplace(500)
      .accounts({
        marketplace: marketplacePda,
        authority: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .rpc();
    console.log(`Marketplace initialized! Transaction: ${tx}\n`);
  }

  //register merchant
  const merchantKeypair = anchor.web3.Keypair.generate();
  const merchantWallet = merchantKeypair.publicKey;
  const [merchantPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("merchant"), marketplacePda.toBuffer(), merchantWallet.toBuffer()],
    program.programId
  );
  console.log(`Merchant PDA: ${merchantPda.toString()}`);
  console.log(`Merchant Wallet: ${merchantWallet.toString()}`);

  try {
    const merchantAccount = await (program.account as any).merchant.fetch(merchantPda);
    console.log("Already registered as merchant\n");
  } catch {
    // fund the merchant wallet first (more than needed for listing creation)
    const merchantRentBalance = await connection.getMinimumBalanceForRentExemption(8 + 32 + 32 + 1 + 1); // removed next_nonce
    const listingRentBalance = await connection.getMinimumBalanceForRentExemption(8 + 32 + 32 + 32 + 8 + 4 + 1 + 1 + 1 + (4 + 100) + (4 + 200) + 8);
    const totalNeeded = merchantRentBalance + listingRentBalance + 5000000; // rent + buffer
    const fundTx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: merchantWallet,
        lamports: totalNeeded,
      })
    );
    await anchor.web3.sendAndConfirmTransaction(connection, fundTx, [walletKeypair]);
    console.log(`Funded merchant wallet with ${totalNeeded} lamports\n`);
    
    const tx = await program.methods
      .registerMerchant()
      .accounts({
        marketplace: marketplacePda,
        merchant: merchantPda,
        owner: merchantWallet,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .signers([merchantKeypair])
      .rpc();
    console.log(`Merchant registered! Transaction: ${tx}\n`);
  }

  //just to test
  //create test SPL token mint
  const mint = await createMint(
    connection,
    walletKeypair,
    wallet.publicKey,
    null,
     6 
  );
  console.log(`Mint created: ${mint.toString()}\n`);

  console.log("Step 4: Mint Test Tokens");
  const buyerAta = getAssociatedTokenAddressSync(mint, wallet.publicKey);
  
  try {
    await getAccount(connection, buyerAta);
    console.log("Token account already exists");
  } catch {
    const createAtaIx = createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      buyerAta,
      wallet.publicKey,
      mint
    );
    await anchor.web3.sendAndConfirmTransaction(
      connection,
      new anchor.web3.Transaction().add(createAtaIx),
      [walletKeypair]
    );
    console.log("Token account created");
  }

  await mintTo(connection, walletKeypair, mint, buyerAta, walletKeypair, 1_000_000);
  console.log("Minted 1 token to wallet");

  //just to test
  // Also mint tokens to merchant for selling
  const merchantAta = getAssociatedTokenAddressSync(mint, merchantWallet);
  try {
    await getAccount(connection, merchantAta);
    console.log("Merchant token account already exists");
  } catch {
    const createMerchantAtaIx = createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      merchantAta,
      merchantWallet,
      mint
    );
    await anchor.web3.sendAndConfirmTransaction(
      connection,
      new anchor.web3.Transaction().add(createMerchantAtaIx),
      [walletKeypair]
    );
    console.log("Merchant token account created");
  }
  await mintTo(connection, walletKeypair, mint, merchantAta, walletKeypair, 10_000_000);
  console.log("Minted 10 tokens to merchant\n");










  //THIS IS WHERE WE CREATE LISTING
  console.log("Step 5: Create Product Listing");
  


  const priceLamports = new anchor.BN(100_000);
  const quantity = 10;
  const name = "Testone yh";
  const imageUrl = "https://somerandomtestimage.com/image.png";

  // Fetch merchant account to get next_nonce field
  const merchantAccount = await program.account.merchant.fetch(merchantPda);
  const nonce = merchantAccount.nextNonce;
  console.log("Using nonce from merchant account:", nonce.toNumber());
  
  // Derive listing PDA using merchant's next_nonce
  const nonceBytes = Buffer.allocUnsafe(8);
  nonceBytes.writeBigUInt64LE(BigInt(nonce.toNumber()), 0);
  
  const [listingPda, listingBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("listing"), merchantPda.toBuffer(), nonceBytes],
    program.programId
  );
  
  console.log("Listing PDA:", listingPda.toBase58());
  console.log("Listing bump:", listingBump);
  console.log("Merchant PDA:", merchantPda.toBase58());

  try {
    const tx = await program.methods
      .createListing(priceLamports, quantity, false, name, imageUrl)
      .accounts({
        marketplace: marketplacePda,
        merchant: merchantPda,
        listing: listingPda,
        owner: merchantWallet,
        mint: mint,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .signers([merchantKeypair])
      .rpc();
    console.log(`Listing created! Transaction: ${tx}`);
    console.log(`Name: ${name}`);
    console.log(`Image URL: ${imageUrl}`);
    console.log(`Price: 0.1 tokens`);
    console.log(`Quantity: ${quantity}\n`);
  } catch (err: any) {
    console.log(`Error creating listing: ${err.message}`);
  }

  //create service listing
  console.log("\nCreating service listing...");
  const merchantAccount2 = await program.account.merchant.fetch(merchantPda);
  const nonce2 = merchantAccount2.nextNonce;
  console.log("Using nonce from merchant account:", nonce2.toNumber());
  
  const nonceBytes2 = Buffer.allocUnsafe(8);
  nonceBytes2.writeBigUInt64LE(BigInt(nonce2.toNumber()), 0);
  
  const [servicePda, serviceBump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("listing"), merchantPda.toBuffer(), nonceBytes2],
    program.programId
  );
  
  try {
    const tx2 = await program.methods
      .createListing(new anchor.BN(500_000), 1, true, "Web Dev", "https://image2.com")
      .accounts({
        marketplace: marketplacePda,
        merchant: merchantPda,
        listing: servicePda,
        owner: merchantWallet,
        mint: mint,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .signers([merchantKeypair])
      .rpc();
    console.log(`Service listing created! Transaction: ${tx2}`);
  } catch (err: any) {
    console.log(`Error creating service listing: ${err.message}`);
  }

  //fetch all listings by PDA directly
  console.log("\nFetching listings by PDA...");
  try {
    const listingPda1 = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("listing"), merchantPda.toBuffer(), Buffer.allocUnsafe(8).fill(0)],
      program.programId
    )[0];
    
    const listing1 = await program.account.listing.fetch(listingPda1);
    console.log("Found first listing:");
    console.log(`Name: ${listing1.name}`);
    console.log(`Image URL: ${listing1.imageUrl}`);
  } catch (error) {
    console.log("Could not fetch listing by PDA:", error.message);
  }

  //test buy now
  console.log("Attempting to buy listing...");
  
  //use PDA we know exists (first listing with nonce 0)
  const listingToBuyPda = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("listing"), merchantPda.toBuffer(), Buffer.allocUnsafe(8).fill(0)],
    program.programId
  )[0];
  
  const listingToBuy = listingToBuyPda;
  console.log(`Found listing to buy: ${listingToBuy.toString()}`);
  
  // Fetch listing to get seller
  const listingData = await program.account.listing.fetch(listingToBuy);
  
  // Fetch marketplace to get authority
  const marketplaceData = await program.account.marketplace.fetch(marketplacePda);
  
  //create seller ATA (merchant's token account)
  const sellerAta = getAssociatedTokenAddressSync(mint, listingData.seller);
  console.log(`Seller ATA: ${sellerAta.toString()}`);
  
  // Create or get treasury ATA (authority = marketplace authority)
  const treasuryAta = getAssociatedTokenAddressSync(mint, marketplaceData.authority);
  console.log(`Treasury ATA: ${treasuryAta.toString()}`);
  
  //just to test
  // Create treasury ATA if it doesn't exist (this is just to test
  try {
    await getAccount(connection, treasuryAta);
    console.log("Treasury token account already exists");
  } catch {
    const createTreasuryAtaIx = createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      treasuryAta,
      marketplaceData.authority,
      mint
    );
    await anchor.web3.sendAndConfirmTransaction(
      connection,
      new anchor.web3.Transaction().add(createTreasuryAtaIx),
      [walletKeypair]
    );
    console.log("Treasury token account created");
  }
  
  // Generate reference - solana pay 
  const reference = anchor.web3.Keypair.generate().publicKey;
  console.log(`Reference: ${reference.toString()}`);
  
  //buy 1 unit
  const buyQuantity = 1;
  
  try {
    console.log(`buying ${buyQuantity} of the listed...`);
    
    const tx = await program.methods
      .buyNow(buyQuantity, reference)
      .accounts({
        listing: listingToBuy,
        marketplace: marketplacePda,
        buyer: wallet.publicKey,
        buyerAta: buyerAta,
        sellerAta: sellerAta,
        treasuryAta: treasuryAta,
        mint: mint,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .remainingAccounts([
        { pubkey: reference, isWritable: false, isSigner: false }
      ])
      .rpc();
    
    console.log(`Buy successful! Transaction: ${tx}\n`);
    
    const updatedListing = await (program.account as any).listing.fetch(listingPda);
    console.log("Listing after purchase:");
    console.log(`Quantity: ${updatedListing.quantity} (prev 10)`);
    console.log(`Active: ${updatedListing.active}\n`);
    
  } catch (error) {
    //if accounts don't exist or have insufficient balance
    console.log(`Buy failed: ${error.message}`);
  }

  // Create service order with escrow
  console.log("\nCREATINg servicce order for just token");
  
  // Derive escrow PDA
  const [escrowPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), servicePda.toBuffer(), wallet.publicKey.toBuffer()],
    program.programId
  );
  
  // Get vault ATA (owned by escrow)
  const vaultAta = getAssociatedTokenAddressSync(mint, escrowPda, true);
  
  // Generate reference for Solana Pay
  const serviceReference = anchor.web3.Keypair.generate().publicKey;
  console.log(`Service Reference: ${serviceReference.toString()}`);
  console.log(`Escrow PDA: ${escrowPda.toString()}`);
  console.log(`Vault ATA: ${vaultAta.toString()}`);
  
  try {
    const tx = await program.methods
      .createServiceOrder(serviceReference)
      .accounts({
        marketplace: marketplacePda,
        listing: servicePda,
        buyer: wallet.publicKey,
        buyerAta: buyerAta,
        escrow: escrowPda,
        vault: vaultAta,
        mint: mint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .remainingAccounts([
        { pubkey: serviceReference, isWritable: false, isSigner: false }
      ])
      .rpc();
    
    console.log(`Service order created! Transaction: ${tx}`);
    console.log(`Funds transferred to escrow vault`);
    
    // Fetch escrow account
    const escrowAccount = await program.account.escrow.fetch(escrowPda);
    console.log(`Escrow amount: ${escrowAccount.amount.toNumber() / 1e6} tokens`);
    console.log(`Released: ${escrowAccount.released}`);
    console.log(`Buyer: ${escrowAccount.buyer.toString()}`);
    console.log(`Seller: ${escrowAccount.seller.toString()}\n`);
    
  } catch (error: any) {
    console.log(`Service order creation failed: ${error.message}`);
    if (error.logs) {
      console.log("Program logs:");
      error.logs.forEach((log: string) => console.log(log));
    }
  }
  
  console.log("\nservice order flow completed");
  console.log("Next:");
  console.log("-Seller completes the service");
  console.log("-Buyer or marketplace calls release_service_order");
  console.log("-Funds released to seller (minus marketplace fee)");
  console.log("-Escrow marked as released");


















  //WSOL create order
  //using wrapped sol
  console.log("\n\nwsol");
  
  // Fund merchant walet more for additional listing
  const additionalFundTx = new anchor.web3.Transaction().add(
    anchor.web3.SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: merchantWallet,
      lamports: 5_000_000, // 0.005 SOL for listing rent
    })
  );
  await anchor.web3.sendAndConfirmTransaction(connection, additionalFundTx, [walletKeypair]);
  console.log("Funded merchant wallet for WSOL listing");
  
  const merchantAccount3 = await program.account.merchant.fetch(merchantPda);
  const nonce3 = merchantAccount3.nextNonce;
  console.log("Using nonce from merchant account:", nonce3.toNumber());
  
  const nonceBytes3 = Buffer.allocUnsafe(8);
  nonceBytes3.writeBigUInt64LE(BigInt(nonce3.toNumber()), 0);
  
  const [wsolServicePda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("listing"), merchantPda.toBuffer(), nonceBytes3],
    program.programId
  );
  
  const wsolPrice = new anchor.BN(100_000_000);
  
  try {
    const tx3 = await program.methods
      .createListing(wsolPrice, 1, true, "hi vida", "randomimage.png")
      .accounts({
        marketplace: marketplacePda,
        merchant: merchantPda,
        listing: wsolServicePda,
        owner: merchantWallet,
        mint: NATIVE_MINT,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .signers([merchantKeypair])
      .rpc();
    console.log(`WSOL service listing created! Transaction: ${tx3}`);
    console.log(`Price: 0.1 SOL (${wsolPrice.toNumber() / 1e9} SOL)`);
  } catch (err: any) {
    console.log(`Error creating WSOL service listing: ${err.message}`);
  }
  
  // buyer process for wsol
  console.log("\nPreparing WSOL for buyer...");
  const buyerWsolAta = getAssociatedTokenAddressSync(NATIVE_MINT, wallet.publicKey);
  
  const wsolAmount = 150_000_000; // 0.15 SOL (more than listing price just fpr safety)
  
  try {
    await getAccount(connection, buyerWsolAta);
    console.log("Buyer WSOL account already exists");
  } catch {
    // Create WSOL account and transfer SOL to it
    const createWsolAtaIx = createAssociatedTokenAccountInstruction(
      wallet.publicKey,
      buyerWsolAta,
      wallet.publicKey,
      NATIVE_MINT
    );
    
    const transferIx = anchor.web3.SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: buyerWsolAta,
      lamports: wsolAmount,
    });
    
    const syncIx = createSyncNativeInstruction(buyerWsolAta);
    
    const tx = new anchor.web3.Transaction()
      .add(createWsolAtaIx)
      .add(transferIx)
      .add(syncIx);
    
    await anchor.web3.sendAndConfirmTransaction(connection, tx, [walletKeypair]);
    console.log(`Wrapped ${wsolAmount / 1e9} SOL for buyer`);
  }
  
  // creating service order for wsol
  console.log("\ncreating service order");
  
  const [wsolEscrowPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), wsolServicePda.toBuffer(), wallet.publicKey.toBuffer()],
    program.programId
  );
  
  const wsolVaultAta = getAssociatedTokenAddressSync(NATIVE_MINT, wsolEscrowPda, true);
  const wsolServiceReference = anchor.web3.Keypair.generate().publicKey;
  
  console.log(`WSOL Service Reference: ${wsolServiceReference.toString()}`);
  console.log(`WSOL Escrow PDA: ${wsolEscrowPda.toString()}`);
  console.log(`WSOL Vault ATA: ${wsolVaultAta.toString()}`);
  
  try {
    const tx = await program.methods
      .createServiceOrder(wsolServiceReference)
      .accounts({
        marketplace: marketplacePda,
        listing: wsolServicePda,
        buyer: wallet.publicKey,
        buyerAta: buyerWsolAta,
        escrow: wsolEscrowPda,
        vault: wsolVaultAta,
        mint: NATIVE_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .remainingAccounts([
        { pubkey: wsolServiceReference, isWritable: false, isSigner: false }
      ])
      .rpc();
    
    console.log(`WSOL service order created! Transaction: ${tx}`);
    console.log(`0.1 SOL locked in escrow`);
    
    const wsolEscrowAccount = await program.account.escrow.fetch(wsolEscrowPda);
    console.log(`Escrow amount: ${wsolEscrowAccount.amount.toNumber() / 1e9} SOL`);
    console.log(`Released: ${wsolEscrowAccount.released}`);
    console.log(`Buyer: ${wsolEscrowAccount.buyer.toString()}`);
    console.log(`Seller: ${wsolEscrowAccount.seller.toString()}\n`);
    
  } catch (error: any) {
    console.log(`WSOL service order creation failed: ${error.message}`);
    if (error.logs) {
      console.log("Program logs:");
      error.logs.forEach((log: string) => console.log(log));
    }
  }
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

