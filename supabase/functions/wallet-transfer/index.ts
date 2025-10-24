import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, createSupabaseClient, errorResponse } from '../_shared/utils.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseClient = createSupabaseClient(req);

    // POST /wallet/transfer - Handle peer-to-peer transfers
    if (req.method === 'POST') {
      const { recipient_id, amount_sol, amount_usdt, transaction_signature, notes } = await req.json();

      if (!recipient_id || (!amount_sol && !amount_usdt)) {
        return errorResponse('recipient_id and amount are required', 400);
      }

      const {
        data: { user },
        error: userError,
      } = await supabaseClient.auth.getUser();

      if (userError || !user) {
        return errorResponse('Unauthorized', 401);
      }

      if (user.id === recipient_id) {
        return errorResponse('Cannot transfer to yourself', 400);
      }

      // Create transfer transaction records
      const { data, error } = await supabaseClient.from('wallet_transactions').insert([
        {
          user_id: user.id,
          transaction_type: 'transfer',
          amount_sol: amount_sol || 0,
          amount_usdt: amount_usdt || 0,
          status: 'completed',
          transaction_signature,
          notes: notes || `Transfer to user ${recipient_id}`,
        },
        {
          user_id: recipient_id,
          transaction_type: 'transfer',
          amount_sol: amount_sol || 0,
          amount_usdt: amount_usdt || 0,
          status: 'completed',
          transaction_signature,
          notes: notes || `Transfer from user ${user.id}`,
        },
      ]).select();

      if (error) {
        return errorResponse(error.message, 500);
      }

      return new Response(
        JSON.stringify({ transactions: data }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return errorResponse('Method not allowed', 405);
  } catch (error) {
    return errorResponse(error.message, 500);
  }
});
