import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Konnect } from "../target/types/konnect";
import { PublicKey, Keypair } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
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
  const [merchantPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("merchant"), marketplacePda.toBuffer(), wallet.publicKey.toBuffer()],
    program.programId
  );
  console.log(`Merchant PDA: ${merchantPda.toString()}`);

  try {
    await (program.account as any).merchant.fetch(merchantPda);
    console.log("Already registered as merchant\n");
  } catch {
    const tx = await program.methods
      .registerMerchant()
      .accounts({
        marketplace: marketplacePda,
        merchant: merchantPda,
        owner: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .rpc();
    console.log(`Merchant registered! Transaction: ${tx}\n`);
  }

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
  console.log("Minted 1 token to wallet\n");

  console.log("Step 5: Create Product Listing");
  const [listingPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("listing"), marketplacePda.toBuffer(), merchantPda.toBuffer(), mint.toBuffer()],
    program.programId
  );
  console.log(`Listing PDA: ${listingPda.toString()}`);

  try {
    await (program.account as any).listing.fetch(listingPda);
    console.log("Listing already exists\n");
  } catch {
    const priceLamports = new anchor.BN(100_000);
    const quantity = 10;
    const name = "Testone yh";
    const imageUrl = "https://somerandomtestimage.com/image.png";

    const tx = await program.methods
      .createListing(priceLamports, quantity, false, name, imageUrl)
      .accounts({
        marketplace: marketplacePda,
        merchant: merchantPda,
        listing: listingPda,
        owner: wallet.publicKey,
        mint: mint,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .rpc();
    console.log(`Listing created! Transaction: ${tx}`);
    console.log(`Name: ${name}`);
    console.log(`Image URL: ${imageUrl}`);
    console.log(`Price: 0.1 tokens`);
    console.log(`Quantity: ${quantity}\n`);
  }

  //fetch all listings
  try {
    const allListings = await (program.account as any).listing.all([
      {
        memcmp: {
          offset: 8, // discriminator
          bytes: marketplacePda.toBase58(),
        },
      },
    ]);

    console.log(`Found ${allListings.length} listing(s):\n`);
      allListings.forEach((listing: any, idx: number) => {
        console.log(`Listing #${idx + 1}:`);
        console.log(`Name: ${listing.account.name}`);
        console.log(`Image URL: ${listing.account.image_url}`);
        console.log(`PDA: ${listing.publicKey.toString()}`);
        console.log(`Seller: ${listing.account.seller.toString()}`);
        console.log(`Mint: ${listing.account.mint.toString()}`);
        console.log(`Price: ${listing.account.price.toString()} lamports`);
        console.log(`Quantity: ${listing.account.quantity}`);
        console.log(`Active: ${listing.account.active}\n`);
      });
  } catch (error) {
    console.log("Could not fetch listings:", error.message);
  }

  //test buy now
  console.log("Attempting to buy listing...");
  
  //create seller ATA
  const sellerAta = getAssociatedTokenAddressSync(mint, wallet.publicKey);
  console.log(`Seller ATA: ${sellerAta.toString()}`);
  
  // Create or get treasury ATA (authority = marketplace authority)
  const treasuryAta = getAssociatedTokenAddressSync(mint, wallet.publicKey); // same as seller but this is justfor demo
  console.log(`Treasury ATA: ${treasuryAta.toString()}`);
  
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
        listing: listingPda,
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

