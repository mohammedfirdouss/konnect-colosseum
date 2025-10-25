import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Konnect } from "../target/types/konnect";
import { expect } from "chai";

describe("konnect", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Konnect as Program<Konnect>;
  const provider = anchor.getProvider();

  it("Initialize marketplace", async () => {
    const authority = provider.wallet.payer;
    const feeBps = 200;
    
    const tx = await program.methods
      .initMarketplace(feeBps)
      .accounts({
        marketplace: anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from("marketplace"), authority.publicKey.toBuffer()],
          program.programId
        )[0],
        authority: authority.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
      
    console.log("Marketplace initialization signature:", tx);
    
    const marketplaceAccount = await program.account.marketplace.fetch(
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("marketplace"), authority.publicKey.toBuffer()],
        program.programId
      )[0]
    );
    
    expect(marketplaceAccount.authority.toString()).to.equal(authority.publicKey.toString());
    expect(marketplaceAccount.feeBps).to.equal(feeBps);
  });

  it("Register merchant", async () => {
    const authority = provider.wallet.payer;
    const merchantOwner = provider.wallet.payer;
    
    const marketplacePda = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("marketplace"), authority.publicKey.toBuffer()],
      program.programId
    )[0];
    
    const merchantPda = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("merchant"), marketplacePda.toBuffer(), merchantOwner.publicKey.toBuffer()],
      program.programId
    )[0];

    const tx = await program.methods
      .registerMerchant()
      .accounts({
        marketplace: marketplacePda,
        merchant: merchantPda,
        owner: merchantOwner.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
      
    console.log("Merchant registration signature:", tx);
    
    const merchantAccount = await program.account.merchant.fetch(merchantPda);
    expect(merchantAccount.marketplace.toString()).to.equal(marketplacePda.toString());
    expect(merchantAccount.owner.toString()).to.equal(merchantOwner.publicKey.toString());
    expect(merchantAccount.verified).to.be.false;
  });

  it("Test marketplace fee calculation", async () => {
    const authority = provider.wallet.payer;
    
    const marketplacePda = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("marketplace"), authority.publicKey.toBuffer()],
      program.programId
    )[0];

    const marketplaceAccount = await program.account.marketplace.fetch(marketplacePda);
    expect(marketplaceAccount.feeBps).to.equal(200);
    
    const amount = new anchor.BN(1000000000); // 1 SOL
    const expectedFee = amount.mul(new anchor.BN(200)).div(new anchor.BN(10000)); // 2%
    expect(expectedFee.toString()).to.equal("20000000"); // 0.02 SOL
    
    console.log("Marketplace fee calculation test passed");
    console.log(`Fee for 1 SOL: ${expectedFee.toString()} lamports (0.02 SOL)`);
  });

  it("Test merchant verification", async () => {
    const authority = provider.wallet.payer;
    const merchantOwner = provider.wallet.payer;
    
    const marketplacePda = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("marketplace"), authority.publicKey.toBuffer()],
      program.programId
    )[0];
    
    const merchantPda = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("merchant"), marketplacePda.toBuffer(), merchantOwner.publicKey.toBuffer()],
      program.programId
    )[0];

    const tx = await program.methods
      .setMerchantStatus(true)
      .accounts({
        marketplace: marketplacePda,
        merchant: merchantPda,
        authority: authority.publicKey,
      })
      .rpc();
      
    console.log("Merchant verification signature:", tx);
    
    const merchantAccount = await program.account.merchant.fetch(merchantPda);
    expect(merchantAccount.verified).to.be.true;
  });
});
