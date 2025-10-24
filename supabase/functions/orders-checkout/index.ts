import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, createSupabaseClient, errorResponse } from '../_shared/utils.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseClient = createSupabaseClient(req);

    // POST /orders/checkout - Create an order
    if (req.method === 'POST') {
      const { item_id, transaction_signature } = await req.json();

      if (!item_id) {
        return errorResponse('item_id is required', 400);
      }

      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabaseClient.auth.getUser();

      if (userError || !user) {
        return errorResponse('Unauthorized', 401);
      }

      // Call the create_order function
      const { data: order, error: orderError } = await supabaseClient.rpc('create_order', {
        p_item_id: item_id,
        p_buyer_id: user.id,
        p_transaction_signature: transaction_signature,
      });

      if (orderError) {
        return errorResponse(orderError.message, 500);
      }

      return new Response(
        JSON.stringify({ order }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return errorResponse('Method not allowed', 405);
  } catch (error) {
    return errorResponse(error.message, 500);
  }
});
