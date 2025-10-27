import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Konnect } from "../target/types/konnect";
import { PublicKey, Keypair } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  mintTo,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
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
  const idlPath = "target/idl/konnect.json";
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

  //create second listing
  console.log("\nCreating second listing...");
  const merchantAccount2 = await program.account.merchant.fetch(merchantPda);
  const nonce2 = merchantAccount2.nextNonce;
  console.log("Using nonce from merchant account:", nonce2.toNumber());
  
  const nonceBytes2 = Buffer.allocUnsafe(8);
  nonceBytes2.writeBigUInt64LE(BigInt(nonce2.toNumber()), 0);
  
  const [listingPda2, listingBump2] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("listing"), merchantPda.toBuffer(), nonceBytes2],
    program.programId
  );
  
  try {
    const tx2 = await program.methods
      .createListing(new anchor.BN(200_000), 5, false, "Second Product", "https://image2.com")
      .accounts({
        marketplace: marketplacePda,
        merchant: merchantPda,
        listing: listingPda2,
        owner: merchantWallet,
        mint: mint,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .signers([merchantKeypair])
      .rpc();
    console.log(`Second listing created! Transaction: ${tx2}`);
  } catch (err: any) {
    console.log(`Error creating second listing: ${err.message}`);
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

  // escrow release process: backend can sign as payer
  //rent goes to buyer via UncheckedAccount
  //Seller receives funds minus fee
  //treasury receives marketplace fee
  //escrow marked as released
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

