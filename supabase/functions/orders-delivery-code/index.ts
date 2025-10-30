import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, createSupabaseClient, errorResponse } from '../_shared/utils.ts';

/**
 * Generate a secure random delivery code
 * Format: 6-digit numeric code
 */
function generateDeliveryCode(): string {
  // Generate a 6-digit code (000000-999999)
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  return code;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseClient = createSupabaseClient(req);

    // POST /orders/delivery-code - Generate or retrieve delivery code for buyer
    if (req.method === 'POST') {
      const { order_id } = await req.json();

      if (!order_id) {
        return errorResponse('order_id is required', 400);
      }

      // Get current user
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

      // Verify the user is the buyer
      if (order.buyer_id !== user.id) {
        return errorResponse('Unauthorized: Only the buyer can generate delivery codes', 403);
      }

      // Check if order is in a valid state
      if (order.status !== 'ongoing') {
        return errorResponse(`Cannot generate delivery code for order with status: ${order.status}`, 400);
      }

      // Generate or retrieve delivery code
      let deliveryCode = order.delivery_code;
      
      if (!deliveryCode) {
        // Generate a new delivery code
        deliveryCode = generateDeliveryCode();
        
        // Update the order with the delivery code
        const { data: updatedOrder, error: updateError } = await supabaseClient
          .from('orders')
          .update({ 
            delivery_code: deliveryCode,
            updated_at: new Date().toISOString()
          })
          .eq('id', order_id)
          .select()
          .single();

        if (updateError) {
          return errorResponse(updateError.message, 500);
        }

        return new Response(
          JSON.stringify({
            order_id: order_id,
            delivery_code: deliveryCode,
            message: 'Delivery code generated successfully',
            order: updatedOrder,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      } else {
        // Return existing delivery code
        return new Response(
          JSON.stringify({
            order_id: order_id,
            delivery_code: deliveryCode,
            message: 'Delivery code retrieved successfully',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // GET /orders/delivery-code?order_id=xxx - Retrieve existing delivery code
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const orderId = url.searchParams.get('order_id');

      if (!orderId) {
        return errorResponse('order_id query parameter is required', 400);
      }

      // Get current user
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
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        return errorResponse('Order not found', 404);
      }

      // Verify the user is the buyer
      if (order.buyer_id !== user.id) {
        return errorResponse('Unauthorized: Only the buyer can view delivery codes', 403);
      }

      if (!order.delivery_code) {
        return errorResponse('No delivery code found for this order. Use POST to generate one.', 404);
      }

      return new Response(
        JSON.stringify({
          order_id: orderId,
          delivery_code: order.delivery_code,
          message: 'Delivery code retrieved successfully',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return errorResponse('Method not allowed', 405);
  } catch (error) {
    return errorResponse(error.message, 500);
  }
});
