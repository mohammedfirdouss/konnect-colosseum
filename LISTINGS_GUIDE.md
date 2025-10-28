# 📖 Complete Guide: Fetching Listings from Smart Contract

## Overview
This guide explains how to retrieve all listings created on your Solana marketplace smart contract.

## Understanding the Process

### 1. **How Listings are Stored**
- Each listing is stored as a **Program Account** on the Solana blockchain
- The account has a unique **PDA (Program Derived Address)** derived from:
  - Seed: `"listing"`
  - Marketplace address
  - Merchant address
  - Mint address
- Each account contains the listing data (price, quantity, seller, etc.)

### 2. **Listing Account Structure** (from IDL)
```typescript
{
  marketplace: PublicKey,    // Marketplace PDA
  seller: PublicKey,         // Seller's public key
  mint: PublicKey,           // Token mint address
  price: BN,                 // Price in lamports/tokens
  quantity: number,          // Quantity available
  isService: boolean,        // Is it a service or good
  active: boolean,           // Is listing active
  bump: number,              // PDA bump seed
}
```

## Implementation Steps

### Step 1: Service Layer (`services/marketplaceService.ts`)

#### Method: `getAllListings(marketplace: PublicKey)`

```typescript
async getAllListings(marketplace: PublicKey): Promise<any[]> {
  try {
    if (!this.program || !this.connection) {
      throw new Error('Program not initialized');
    }

    console.log('Fetching all listings for marketplace:', marketplace.toString());

    // Use Anchor's account namespace to fetch and deserialize listings
    const listings = await this.program.account.listing.all Summer([
      {
        memcmp: {
          offset: 8,              // Skip 8-byte discriminator
          bytes: marketplace.toBase58(),  // Filter by marketplace
        },
      },
    ]);

    console.log(`Found ${listings.length} listings`);

    // Transform to usable format
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
```

#### Method: `getActiveListings(marketplace: PublicKey)`

```typescript
async getActiveListings(marketplace: PublicKey): Promise<any[]> {
  try {
    // Fetch all listings
    const allListings = await this.program.account.listing.all([
      {
        memcmp: {
          offset: 8,
          bytes: marketplace.toBase58(),
        },
      },
    ]);

    // Filter to only active listings
    const activeListings = allListings.filter((item: any) => item.account.active);

    // Transform and return
    return activeListings.map((item: any) => ({
      address: item.publicKey.toString(),
      marketplace: item.account.marketplace.toString(),
      seller: item.account.seller.toString(),
      mint: item.account.mint.toString(),
      price: item.account.price.toNumber(),
      quantity: item.account.quantity,
      isService: item.account.isService,
      active: item.account.active,
      bump: item.account.bump,
    }));
  } catch (error) {
    throw error;
  }
}
```

#### Method: `getListingsBySeller(marketplace: PublicKey, seller: PublicKey)`

```typescript
async getListingsBySeller(marketplace: PublicKey, seller: PublicKey): Promise<any[]> {
  try {
    // Fetch all listings for the marketplace
    const allListings = await this.program.account.listing.all([
      {
        memcmp: {
          offset: 8,              // Skip discriminator
          bytes: marketplace.toBase58(),
        },
      },
    ]);

    // Filter by seller
    const sellerListings = allListings.filter(
      (item: any) => item.account.seller.equals(seller)
    );

    // Transform and return
    return sellerListings.map((item: any) => ({
      address: item.publicKey.toString(),
      marketplace: item.account.marketplace.toString(),
      seller: item.account.seller.toString(),
      mint: item.account.mint.toString(),
      price: item.account.price.toNumber(),
      quantity: item.account.quantity,
      isService: item.account.isService,
      active: item.account.active,
    }));
  } catch (error) {
    throw error;
  }
}
```

### Step 2: Hook Layer (`hooks/useMarketplace.tsx`)

The hook exposes these methods for components to use:

```typescript
const { getAllListings, getActiveListings, getListingsBySeller } = useMarketplace();
```

### Step 3: Component Usage Example

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useMarketplace } from '@/hooks/useMarketplace';
import { PublicKey } from '@solana/web3.js';

export function ListingsDisplay() {
  const { connected, publicKey } = useWallet();
  const { getAllListings, getMarketplaceAddress } = useMarketplace();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchListings = async () => {
      if (connected && publicKey) {
        try {
          setLoading(true);
          
          // Get marketplace address
          const marketplaceAddress = getMarketplaceAddress(publicKey);
          
          if (marketplaceAddress) {
            // Fetch all listings
            const fetchedListings = await getAllListings(marketplaceAddress);
            setListings(fetchedListings);
            
            console.log('Loaded listings:', fetchedListings.length);
          }
        } catch (error) {
          console.error('Error fetching listings:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchListings();
  }, [connected, publicKey, getAllListings, getMarketplaceAddress]);

  return (
    <div>
      {loading && <p>Loading listings...</p>}
      {listings.map((listing) => (
        <div key={listing.address}>
          <h3>Price: {listing.price}</h3>
          <p>Quantity: {listing.quantity}</p>
          <p>Type: {listing.isService ? 'Service' : 'Good'}</p>
          <p>Active: {listing.active ? 'Yes' : 'No'}</p>
        </div>
      ))}
    </div>
  );
}
```

## Key Concepts Explained

### 1. **Discriminator**
- First 8 bytes of an account that Anchor uses to identify the account type
- We skip it when filtering: `offset: 8`

### 2. **memcmp Filter**
- Memory comparison filter used to filter accounts
- `bytes: marketplace.toBase58()` filters accounts by marketplace address
- Only returns accounts where this matches

### 3. **Anchor's Account Namespace**
- `program.account.listing.nd()` provides convenient access to listings
- Automatically handles:
  - Account deserialization (converts raw bytes to structured data)
  - Discriminator checking (only fetches listing accounts)
  - Filtering

### 4. **Account Deserialization**
When we call `program.account.listing.all()`, Anchor:
1. Fetches all program accounts
2. Checks the discriminator to identify listing accounts
3. Deserializes the data using the IDL schema
4. Returns structured, typed data

## Advanced Filtering

### Filter by Multiple Conditions
```typescript
const listings = await this.program.account.listing.all([
  {
    memcmp: {
      offset: 8,              // marketplace
      bytes: marketplace.toBase58(),
    },
  },
  {
    dataSize: 200,  // Filter by account size (useful for filtering account types)
  },
]);
```

### Filter by Seller
```typescript
const listings = await this.program.account.listing.all([
  {
    memcmp: {
      offset: 40,  // Seller address is at offset 40 (after marketplace 32 bytes)
      bytes: seller.toBase58(),
    },
  },
]);
```

## Troubleshooting

### Issue: "Program not initialized"
**Solution:** Ensure wallet is connected and program is properly initialized

### Issue: "No listings found"
**Possible causes:**
- Marketplace hasn't been initialized
- No listings created yet
- Wrong marketplace address used

### Issue: Slow fetching
**Optimization:** 
- Cache results in React state
- Use pagination for large datasets
- Filter on the server/client as needed

## Best Practices

1. **Fetch listings once** and cache in state
2. **Use active listings filter** for better performance
3. **Handle loading states** properly
4. **Show error messages** when fetching fails
5. **Refresh periodically** or after mutations
6. **Use pagination** for large datasets

## Example: Displaying Listings in UI

```typescript
{listings.map((listing) => (
  <Card key={listing.address}>
    <h3>Price: {listing.price / 1e9} SOL</h3>
    <p>Quantity: {listing.quantity}</p>
    <p>Type: {listing.isService ? 'Service' : 'Good'}</p>
    <p>Seller: {listing.seller.substring(0, 8)}...</p>
    {listing.active && <Button>Buy Now</Button>}
  </Card>
))}
```

This guide provides everything you need to successfully fetch and display listings from your smart contract!

