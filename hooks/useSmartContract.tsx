import { Program, AnchorProvider, Idl } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

// Import IDL as a module instead of JSON
const idl = require("../idl.json");

const PROGRAM_ID = new PublicKey(idl.address);

export const useSmartContract = () => {
  const { connection } = useConnection();
  const wallet = useWallet();

  const getProgram = () => {
    if (!wallet.publicKey) {
      throw new Error("Wallet not connected");
    }

    const provider = new AnchorProvider(
      connection,
      wallet as any,
      {
        preflightCommitment: "confirmed",
        commitment: "confirmed",
        skipPreflight: false,
      }
    );

    // Create program with explicit typing
    const program = new Program(idl as Idl, provider);
    
    // Verify the program has the expected methods
    if (!program.methods || !program.methods.initMarketplace) {
      throw new Error("Program methods not properly initialized");
    }

    return program;
  };

  return {
    program: wallet.publicKey ? getProgram() : null,
    programId: PROGRAM_ID,
  };
};
