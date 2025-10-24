# Konnect Backend - Supabase Setup

This directory contains the backend infrastructure for Konnect, a decentralized campus marketplace on Solana.

## Project Structure

```
supabase/
├── config.toml              # Supabase configuration
├── migrations/               # Database migrations
│   └── 20240101000000_initial_schema.sql
└── functions/                # Edge Functions
    ├── _shared/             # Shared utilities
    │   ├── cors.ts
    │   └── types.ts
    ├── auth-register/       # User registration
    ├── auth-login/          # User login
    ├── items/               # Marketplace listings
    ├── orders-checkout/     # Create orders
    ├── orders-buyer/        # Get buyer orders
    ├── orders-seller/       # Get seller orders
    ├── orders-deliver/      # Confirm delivery
    ├── wallet-balance/      # Get wallet balance
    ├── wallet-history/      # Get transaction history
    ├── wallet-transfer/     # P2P transfers
    └── gamification-profile/ # Get gamification data
```

## Setup Instructions

### Prerequisites

- Node.js 18+ or Deno 1.30+
- Supabase CLI installed: `npm install -g supabase`

### Initial Setup

1. **Login to Supabase:**
   ```bash
   supabase login
   ```

2. **Link to your project:**
   ```bash
   supabase link --project-ref your-project-ref
   ```

3. **Start local development:**
   ```bash
   supabase start
   ```

4. **Run migrations:**
   ```bash
   supabase db reset
   ```

### Environment Variables

Create a `.env` file in the root directory:

```env
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Deploy Edge Functions

Deploy all functions:
```bash
supabase functions deploy
```

Deploy a specific function:
```bash
supabase functions deploy auth-register
```

### Testing Locally

Start the local Supabase instance:
```bash
supabase start
```

Test Edge Functions locally:
```bash
supabase functions serve
```

## API Endpoints

### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login user

### Marketplace
- `GET /items` - Get all active items
- `POST /items` - Create a new listing

### Orders
- `POST /orders/checkout` - Create an order
- `GET /orders/buyer` - Get buyer's orders
- `GET /orders/seller` - Get seller's orders
- `PUT /orders/deliver` - Confirm delivery

### Wallet
- `GET /wallet/balance` - Get wallet balance
- `GET /wallet/history` - Get transaction history
- `POST /wallet/transfer` - Transfer funds

### Gamification
- `GET /gamification/profile` - Get user's gamification data

## Database Schema

The database includes the following tables:
- `users` - User profiles and authentication
- `items` - Marketplace listings
- `orders` - Order tracking and escrow
- `wallet_transactions` - Transaction history
- `user_gamification` - Points, levels, and badges

All tables have Row-Level Security (RLS) enabled with appropriate policies.

## Development Workflow

1. Make changes to Edge Functions in `supabase/functions/`
2. Test locally with `supabase functions serve`
3. Deploy with `supabase functions deploy`
4. Monitor logs with `supabase functions logs`

## Next Steps

- Integrate Solana SDK for actual blockchain transactions
- Add comprehensive error handling
- Implement rate limiting
- Add request validation middleware
- Set up automated testing
