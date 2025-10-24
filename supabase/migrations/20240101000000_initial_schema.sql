-- Konnect Database Schema
-- Initial migration for MVP

-- Enable necessary extensions in public schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA public;

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer', 'seller', 'both')),
    solana_wallet_address TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    profile_image_url TEXT,
    campus TEXT,
    verified BOOLEAN DEFAULT FALSE
);

-- Items/Listings table
CREATE TABLE public.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('goods', 'services')),
    price_sol DECIMAL(18, 9) NOT NULL,
    price_usdt DECIMAL(18, 9),
    images TEXT[],
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    tags TEXT[],
    condition TEXT CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'poor'))
);

-- Orders table
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ongoing', 'completed', 'cancelled', 'disputed')),
    total_amount_sol DECIMAL(18, 9) NOT NULL,
    total_amount_usdt DECIMAL(18, 9),
    escrow_address TEXT,
    delivery_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    transaction_signature TEXT
);

-- Wallet table
CREATE TABLE public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'transfer', 'escrow_lock', 'escrow_release', 'payment_received', 'payment_sent')),
    amount_sol DECIMAL(18, 9) NOT NULL,
    amount_usdt DECIMAL(18, 9),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    transaction_signature TEXT,
    related_order_id UUID REFERENCES public.orders(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- Gamification table
CREATE TABLE public.user_gamification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    total_points INTEGER DEFAULT 0,
    current_level INTEGER DEFAULT 1,
    badges TEXT[] DEFAULT '{}',
    transactions_completed INTEGER DEFAULT 0,
    items_sold INTEGER DEFAULT 0,
    items_purchased INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_items_seller ON public.items(seller_id);
CREATE INDEX idx_items_category ON public.items(category);
CREATE INDEX idx_items_status ON public.items(status);
CREATE INDEX idx_orders_buyer ON public.orders(buyer_id);
CREATE INDEX idx_orders_seller ON public.orders(seller_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_wallet_transactions_user ON public.wallet_transactions(user_id);
CREATE INDEX idx_wallet_transactions_type ON public.wallet_transactions(transaction_type);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_gamification ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view their own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON public.users FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id);

-- RLS Policies for items table
CREATE POLICY "Anyone can view active items"
    ON public.items FOR SELECT
    USING (status = 'active');

CREATE POLICY "Sellers can create their own items"
    ON public.items FOR INSERT
    WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their own items"
    ON public.items FOR UPDATE
    USING (auth.uid() = seller_id);

-- RLS Policies for orders table
CREATE POLICY "Users can view their own orders"
    ON public.orders FOR SELECT
    USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Buyers can create orders"
    ON public.orders FOR INSERT
    WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Sellers can update their own orders"
    ON public.orders FOR UPDATE
    USING (auth.uid() = seller_id);

-- RLS Policies for wallet_transactions table
CREATE POLICY "Users can view their own transactions"
    ON public.wallet_transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own transactions"
    ON public.wallet_transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_gamification table
CREATE POLICY "Users can view their own gamification data"
    ON public.user_gamification FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own gamification data"
    ON public.user_gamification FOR UPDATE
    USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON public.items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_gamification_updated_at BEFORE UPDATE ON public.user_gamification
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create gamification entry for new users
CREATE OR REPLACE FUNCTION create_user_gamification()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_gamification (user_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create gamification entry when user is created
CREATE TRIGGER create_gamification_on_user_create
    AFTER INSERT ON public.users
    FOR EACH ROW EXECUTE FUNCTION create_user_gamification();

-- Function to award points on order completion
CREATE OR REPLACE FUNCTION award_points_on_completion()
RETURNS TRIGGER AS $$
DECLARE
    points_to_award INTEGER := 10;
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- Award points to buyer
        UPDATE public.user_gamification
        SET total_points = total_points + points_to_award,
            transactions_completed = transactions_completed + 1,
            items_purchased = items_purchased + 1
        WHERE user_id = NEW.buyer_id;
        
        -- Award points to seller
        UPDATE public.user_gamification
        SET total_points = total_points + points_to_award,
            transactions_completed = transactions_completed + 1,
            items_sold = items_sold + 1
        WHERE user_id = NEW.seller_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to award points on order completion
CREATE TRIGGER award_points_on_order_completion
    AFTER UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION award_points_on_completion();
