import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, createSupabaseClient, errorResponse } from '../_shared/utils.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseClient = createSupabaseClient(req);

    // GET /orders/seller - Get all orders for the seller
    if (req.method === 'GET') {
      const {
        data: { user },
        error: userError,
      } = await supabaseClient.auth.getUser();

      if (userError || !user) {
        return errorResponse('Unauthorized', 401);
      }

      const { data, error } = await supabaseClient
        .from('orders')
        .select('*, item:items(*), buyer:users!orders_buyer_id_fkey(username, email)')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        return errorResponse(error.message, 500);
      }

      return new Response(
        JSON.stringify({ orders: data }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return errorResponse('Method not allowed', 405);
  } catch (error) {
    return errorResponse(error.message, 500);
  }
});
