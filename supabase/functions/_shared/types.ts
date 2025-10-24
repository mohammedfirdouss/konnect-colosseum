// Shared types for Edge Functions

export interface User {
  id: string;
  email: string;
  username?: string;
  role: 'buyer' | 'seller' | 'both';
  solana_wallet_address?: string;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  seller_id: string;
  title: string;
  description?: string;
  category: 'goods' | 'services';
  price_sol: number;
  price_usdt?: number;
  images?: string[];
  status: 'active' | 'sold' | 'inactive';
  created_at: string;
  updated_at: string;
  tags?: string[];
  condition?: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
}

export interface Order {
  id: string;
  buyer_id: string;
  seller_id: string;
  item_id: string;
  status: 'pending' | 'ongoing' | 'completed' | 'cancelled' | 'disputed';
  total_amount_sol: number;
  total_amount_usdt?: number;
  escrow_address?: string;
  delivery_code?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  transaction_signature?: string;
}

export interface WalletTransaction {
  id: string;
  user_id: string;
  transaction_type: 'deposit' | 'withdrawal' | 'transfer' | 'escrow_lock' | 'escrow_release' | 'payment_received' | 'payment_sent';
  amount_sol: number;
  amount_usdt?: number;
  status: 'pending' | 'completed' | 'failed';
  transaction_signature?: string;
  related_order_id?: string;
  created_at: string;
  notes?: string;
}

export interface UserGamification {
  id: string;
  user_id: string;
  total_points: number;
  current_level: number;
  badges: string[];
  transactions_completed: number;
  items_sold: number;
  items_purchased: number;
  created_at: string;
  updated_at: string;
}
