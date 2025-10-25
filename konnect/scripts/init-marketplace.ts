import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Konnect } from "../target/types/konnect";



async function initializeMarketplace() {
  if (!process.env.ANCHOR_PROVIDER_URL) {
    process.env.ANCHOR_PROVIDER_URL = "https://api.devnet.solana.com";
  }
  if (!process.env.ANCHOR_WALLET) {
    process.env.ANCHOR_WALLET = require('os').homedir() + "/.config/solana/id.json";
  }
  
  // setup provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Konnect as Program<Konnect>;
  
  console.log(`Program ID: ${program.programId.toString()}`);
  console.log(`Authority: ${provider.wallet.publicKey.toString()}`);

  //Generate marketplace pda
  const marketplacePda = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("marketplace"), provider.wallet.publicKey.toBuffer()],
    program.programId
  )[0];

  console.log(`Marketplace PDA: ${marketplacePda.toString()}`);

  try {
    //initialize marketplace with 2% fee (200 bpS)
    const tx = await program.methods
      .initMarketplace(200)
      .accounts({
        marketplace: marketplacePda,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .rpc();

    console.log("initialized successfully!");
    console.log(`Transaction signature: ${tx}`);
    
    // verify marketplace was created
    const marketplaceAccount = await program.account.marketplace.fetch(marketplacePda);
    console.log("\nmarketplace details:");
    console.log(`Authority: ${marketplaceAccount.authority.toString()}`);
    console.log(`Fee BPS: ${marketplaceAccount.feeBps} (${marketplaceAccount.feeBps / 100}%)`);
    console.log(`Bump: ${marketplaceAccount.bump}`);

    // generate configuration for frontend
    const config = {
      PROGRAM_ID: program.programId.toString(),
      MARKETPLACE_PDA: marketplacePda.toString(),
      AUTHORITY: provider.wallet.publicKey.toString(),
      FEE_BPS: marketplaceAccount.feeBps,
      NETWORK: provider.connection.rpcEndpoint.includes("devnet") ? "devnet" : "mainnet-beta",
      RPC_URL: provider.connection.rpcEndpoint,
      INITIALIZED_AT: new Date().toISOString(),
      TRANSACTION_SIGNATURE: tx
    };

    console.log(JSON.stringify(config, null, 2));

    return config;

  } catch (error) {
    if (error.message.includes("already in use") || error.message.includes("custom program error: 0x0")) {
      console.log("\nMarketplace already exist");
      
      try {
        // fetch existing marketplace
        const marketplaceAccount = await program.account.marketplace.fetch(marketplacePda);
        console.log("existing marketplace:");
        console.log(`Authority: ${marketplaceAccount.authority.toString()}`);
        console.log(`fee: ${marketplaceAccount.feeBps} (${marketplaceAccount.feeBps / 100}%)`);

        const config = {
          PROGRAM_ID: program.programId.toString(),
          MARKETPLACE_PDA: marketplacePda.toString(),
          AUTHORITY: marketplaceAccount.authority.toString(),
          FEE_BPS: marketplaceAccount.feeBps,
          NETWORK: provider.connection.rpcEndpoint.includes("devnet") ? "devnet" : "mainnet-beta",
          RPC_URL: provider.connection.rpcEndpoint,
          STATUS: "EXISTING",
          CHECKED_AT: new Date().toISOString()
        };

        console.log("\nCurrent Config:");
        console.log(JSON.stringify(config, null, 2));
        
        return config;
        
      } catch (fetchError) {
        console.error("Err:", fetchError);
        throw error;
      }
    }
    
    console.error("Error:", error);
    throw error;
  }
}

// run if called directly
if (require.main === module) {
  initializeMarketplace()
    .then((config) => {
      console.log("\ninitialization complete!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Initialization failed:", error.message);
      process.exit(1);
    });
}

export { initializeMarketplace };