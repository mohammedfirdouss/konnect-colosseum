CREATE OR REPLACE FUNCTION public.award_first_purchase_badge()
RETURNS TRIGGER AS $$
DECLARE
    completed_orders_count INTEGER;
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- Check if this is the buyer's first completed order
        SELECT COUNT(*) INTO completed_orders_count
        FROM public.orders
        WHERE buyer_id = NEW.buyer_id AND status = 'completed';

        IF completed_orders_count = 1 THEN
            -- Award the "First Purchase" badge
            UPDATE public.user_gamification
            SET badges = array_append(badges, 'First Purchase')
            WHERE user_id = NEW.buyer_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER award_first_purchase_badge_trigger
    AFTER UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION award_first_purchase_badge();
