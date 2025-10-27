'use client'

import { useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import {
  PublicKey,
  SystemProgram,
  Keypair,
  Transaction,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import * as anchor from '@coral-xyz/anchor'
import { Buffer } from 'buffer'
import { Program, BN } from '@coral-xyz/anchor'
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import idlJson from '../idl/konnect.json'

const PROGRAM_ID = new PublicKey(
  'mbLjS3jLDX74Ptza9EiiG4qcPPE9aPS7EzifCLZc5hJ'
)
const MARKETPLACE_PDA = new PublicKey(
  '3DqwXpNUVu14PpGF6XVAFtmnZtCDJ2Zkapn2PaEWgcxN'
)

function makeAnchorWallet(wallet: any): any {
  return {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions:
      wallet.signAllTransactions ||
      (async (txs: any[]) =>
        Promise.all(txs.map((tx) => wallet.signTransaction(tx)))),
  } as any
}


export default function Marketplace() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const { setVisible } = useWalletModal()

  const [program, setProgram] = useState<Program | null>(null)
  const [listings, setListings] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  
  useEffect(() => {
    if (!wallet.connected || !connection || !wallet.publicKey) {
      setProgram(null)
      return
    }
  
    let timer: NodeJS.Timeout
  
    const check = () => {
      if (wallet.signTransaction) {
        clearInterval(timer)
        initializeProgram()
      }
    }
  
    timer = setInterval(check, 100)
    check() 
  
    return () => clearInterval(timer)
  }, [wallet.connected, connection, wallet.publicKey])

  const initializeProgram = () => {
    try {
      const anchorWallet = makeAnchorWallet(wallet)
      const provider = new anchor.AnchorProvider(connection, anchorWallet, {
        commitment: 'confirmed',
      })
      anchor.setProvider(provider)
    } catch (err) {
      console.error('Program init error', err)
      setProgram(null)
    }
  }

  useEffect(() => {
    if (!program) return

    const fetch = async () => {
      try {
        const accounts = await program.account.listing.all([
          {
            memcmp: {
              offset: 8,
              bytes: MARKETPLACE_PDA.toBase58(),
            },
          },
        ])
        setListings(accounts)
      } catch (e) {
        console.error('fetch listings', e)
      }
    }
    fetch()
  }, [program])

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!program || !wallet.publicKey) return

    setLoading(true)
    setStatus('Creating…')

    try {
      const form = new FormData(e.target as HTMLFormElement)
      const price = parseFloat(form.get('price') as string)
      const qty = parseInt(form.get('quantity') as string, 10)

      if (isNaN(price) || isNaN(qty) || price <= 0 || qty <= 0) {
        throw new Error('Invalid price/quantity')
      }

      // merchant PDA
      const [merchantPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('merchant'),
          MARKETPLACE_PDA.toBuffer(),
          wallet.publicKey.toBuffer(),
        ],
        PROGRAM_ID
      )

      // verify merchant exists
      try {
        await program.account.merchant.fetch(merchantPda)
      } catch {
        throw new Error('Register as a merchant first')
      }

      if (!listings.length) throw new Error('No mint available')
      const mint = listings[0].account.mint

      // listing PDA
      const [listingPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('listing'),
          MARKETPLACE_PDA.toBuffer(),
          merchantPda.toBuffer(),
          mint.toBuffer(),
        ],
        PROGRAM_ID
      )

      // create
      const sig = await program.methods
        .createListing(new BN(price * LAMPORTS_PER_SOL), qty, false, name, imageUrl)
        .accounts({
          marketplace: MARKETPLACE_PDA,
          merchant: merchantPda,
          listing: listingPda,
          owner: wallet.publicKey,
          mint,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      setStatus(`Created! ${sig.slice(0, 8)}…`)
      // refresh
      const accounts = await program.account.listing.all([
        { memcmp: { offset: 8, bytes: MARKETPLACE_PDA.toBase58() } },
      ])
      setListings(accounts)
    } catch (err: any) {
      setStatus(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleBuyNow = async (listing: any) => {
    if (!program || !wallet.publicKey) return

    setLoading(true)
    setStatus('Buying…')

    try {
      const reference = Keypair.generate().publicKey
      const sellerAta = getAssociatedTokenAddressSync(
        listing.account.mint,
        listing.account.seller
      )
      const buyerAta = getAssociatedTokenAddressSync(
        listing.account.mint,
        wallet.publicKey
      )
      const treasuryAta = getAssociatedTokenAddressSync(
        listing.account.mint,
        MARKETPLACE_PDA
      )

      const sig = await program.methods
        .buyNow(1, reference)
        .accounts({
          listing: listing.publicKey,
          marketplace: MARKETPLACE_PDA,
          buyer: wallet.publicKey,
          buyerAta,
          sellerAta,
          treasuryAta,
          mint: listing.account.mint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .remainingAccounts([
          { pubkey: reference, isWritable: false, isSigner: false },
        ])
        .rpc()

      setStatus(`Bought! ${sig.slice(0, 8)}…`)
      // refresh
      const accounts = await program.account.listing.all([
        { memcmp: { offset: 8, bytes: MARKETPLACE_PDA.toBase58() } },
      ])
      setListings(accounts)
    } catch (err: any) {
      setStatus(`Buy failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (!wallet.connected) {
    return (
      <div>
        <h1>Konnect Marketplace</h1>
        <p>Connect your wallet to continue</p>
        <button onClick={() => setVisible(true)}>Connect Wallet</button>
      </div>
    )
  }

  return (
    <div>
      <div>
        <h1>Konnect Marketplace</h1>
        <button onClick={() => wallet.disconnect()}>Disconnect</button>
      </div>

      <p>
        <strong>Wallet:</strong>{' '}
        {wallet.publicKey?.toString().slice(0, 8)}...
        {wallet.publicKey?.toString().slice(-4)}
      </p>

      <p>
        <strong>Program:</strong>{' '}
        <span style={{ color: program ? 'green' : 'red' }}>
          {program ? 'Initialized' : 'NOT INITIALIZED'}
        </span>
      </p>

      {status && (
        <p>
          {status}
        </p>
      )}

      <div>
        <h2>Create Listing (Demo)</h2>
        <form onSubmit={handleCreateListing} style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <input
            name="price"
            type="number"
            step="0.000000001"
            placeholder="Price (SOL)"
            required
          />
          <input
            name="quantity"
            type="number"
            placeholder="Qty"
            required
          />
          <button
            type="submit"
            disabled={loading}
          >
            {loading ? 'Creating…' : 'Create'}
          </button>
        </form>
      </div>

      <h2>Listings ({listings.length})</h2>

      {listings.length === 0 ? (
        <p>No listings yet – create one above!</p>
      ) : (
        <div>
          {listings.map((l) => (
            <div>
              <p>
                {l.publicKey.toString()}
              </p>
              <div>
                <div>
                  <strong>Seller:</strong> {l.account.seller.toString().slice(0, 8)}...
                </div>
                <div>
                  <strong>Price:</strong> {(Number(l.account.price) / LAMPORTS_PER_SOL).toFixed(6)} SOL
                </div>
                <div>
                  <strong>Qty:</strong> {l.account.quantity}
                </div>
                <div>
                  <strong>Active:</strong>{' '}
                  <span>
                    {l.account.active ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleBuyNow(l)}
                disabled={loading || !l.account.active}
              >
                Buy 1 Unit
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}