import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // PUT /orders/deliver - Seller confirms delivery with code
    if (req.method === 'PUT') {
      const { order_id, delivery_code, transaction_signature } = await req.json();

      if (!order_id || !delivery_code) {
        return new Response(
          JSON.stringify({ error: 'order_id and delivery_code are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const {
        data: { user },
        error: userError,
      } = await supabaseClient.auth.getUser();

      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch the order
      const { data: order, error: orderError } = await supabaseClient
        .from('orders')
        .select('*')
        .eq('id', order_id)
        .single();

      if (orderError || !order) {
        return new Response(
          JSON.stringify({ error: 'Order not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (order.seller_id !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized to deliver this order' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate delivery code (in production, this would be more secure)
      if (order.delivery_code && order.delivery_code !== delivery_code) {
        return new Response(
          JSON.stringify({ error: 'Invalid delivery code' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
