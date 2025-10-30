import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, createSupabaseClient, errorResponse } from '../_shared/utils.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseClient = createSupabaseClient(req);

    // PUT /orders/deliver - Seller confirms delivery with code
    if (req.method === 'PUT') {
      const { order_id, delivery_code, transaction_signature } = await req.json();

      if (!order_id || !delivery_code) {
        return errorResponse('order_id and delivery_code are required', 400);
      }

      const {
        data: { user },
        error: userError,
      } = await supabaseClient.auth.getUser();

      if (userError || !user) {
        return errorResponse('Unauthorized', 401);
      }

      // Fetch the order
      const { data: order, error: orderError } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('id', order_id)
        .single();

      if (orderError || !order) {
        return errorResponse('Order not found', 404);
      }

      if (order.seller_id !== user.id) {
        return errorResponse('Unauthorized to deliver this order', 403);
      }

      // Validate delivery code exists
      if (!order.delivery_code) {
        return errorResponse('No delivery code has been generated for this order. Buyer must generate a delivery code first.', 400);
      }

      // Validate delivery code matches
      if (order.delivery_code !== delivery_code) {
        return errorResponse('Invalid delivery code', 400);
      }

      // Check if order is already completed
      if (order.status === 'completed') {
        return errorResponse('Order is already completed', 400);
      }

      // Ensure order is in ongoing status
      if (order.status !== 'ongoing') {
        return errorResponse(`Cannot complete delivery for order with status: ${order.status}`, 400);
      }

      // Update order status to completed
      const { data: updatedOrder, error: updateError } = await supabaseClient
        .from('orders')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', order_id)
        .select()
        .single();

      if (updateError) {
        return errorResponse(updateError.message, 500);
      }

      // Create escrow release transaction record
      await supabaseClient.from('wallet_transactions').insert([
        {
          user_id: order.seller_id,
          transaction_type: 'escrow_release',
          amount_sol: order.total_amount_sol,
          amount_usdt: order.total_amount_usdt,
          status: 'completed',
          transaction_signature,
          related_order_id: order.id,
          notes: `Escrow released for order ${order.id}`,
        },
        {
          user_id: order.buyer_id,
          transaction_type: 'payment_sent',
          amount_sol: order.total_amount_sol,
          amount_usdt: order.total_amount_usdt,
          status: 'completed',
          transaction_signature,
          related_order_id: order.id,
          notes: `Payment sent for order ${order.id}`,
        },
      ]);

      return new Response(
        JSON.stringify({ order: updatedOrder }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return errorResponse('Method not allowed', 405);
  } catch (error) {
    return errorResponse(error.message, 500);
  }
});
