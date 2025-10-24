CREATE OR REPLACE FUNCTION public.create_order(
    p_item_id UUID,
    p_buyer_id UUID,
    p_transaction_signature TEXT
)
RETURNS TABLE (
    id UUID,
    buyer_id UUID,
    seller_id UUID,
    item_id UUID,
    status TEXT,
    total_amount_sol DECIMAL,
    total_amount_usdt DECIMAL,
    escrow_address TEXT,
    delivery_code TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    transaction_signature TEXT
) AS $$
DECLARE
    v_item public.items;
    v_order public.orders;
BEGIN
    -- 1. Fetch the item and lock the row for update
    SELECT * INTO v_item FROM public.items WHERE public.items.id = p_item_id FOR UPDATE;

    -- 2. Check if the item is available for purchase
    IF v_item IS NULL THEN
        RAISE EXCEPTION 'Item not found';
    END IF;

    IF v_item.status != 'active' THEN
        RAISE EXCEPTION 'Item is not available for purchase';
    END IF;

    -- 3. Create the order
    INSERT INTO public.orders (
        buyer_id,
        seller_id,
        item_id,
        total_amount_sol,
        total_amount_usdt,
        transaction_signature,
        status
    )
    VALUES (
        p_buyer_id,
        v_item.seller_id,
        p_item_id,
        v_item.price_sol,
        v_item.price_usdt,
        p_transaction_signature,
        'ongoing'
    )
    RETURNING * INTO v_order;

    -- 4. Mark the item as sold
    UPDATE public.items
    SET status = 'sold'
    WHERE public.items.id = p_item_id;

    -- 5. Create the escrow lock transaction record
    INSERT INTO public.wallet_transactions (
        user_id,
        transaction_type,
        amount_sol,
        amount_usdt,
        status,
        transaction_signature,
        related_order_id,
        notes
    )
    VALUES (
        p_buyer_id,
        'escrow_lock',
        v_item.price_sol,
        v_item.price_usdt,
        'completed',
        p_transaction_signature,
        v_order.id,
        'Escrow locked for order ' || v_order.id
    );

    -- 6. Return the created order
    RETURN QUERY SELECT * FROM public.orders WHERE public.orders.id = v_order.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;