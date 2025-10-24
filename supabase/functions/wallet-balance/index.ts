import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, createSupabaseClient, errorResponse } from '../_shared/utils.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseClient = createSupabaseClient(req);

    // GET /wallet/balance - Get user's wallet balance
    if (req.method === 'GET') {
      const {
        data: { user },
        error: userError,
      } = await supabaseClient.auth.getUser();

      if (userError || !user) {
        return errorResponse('Unauthorized', 401);
      }

      // Calculate balance from transactions
      const { data: transactions, error: transError } = await supabaseClient
        .from('wallet_transactions')
        .select('transaction_type, amount_sol, amount_usdt, status')
        .eq('user_id', user.id)
        .eq('status', 'completed');

      if (transError) {
        return errorResponse(transError.message, 500);
      }

      // Calculate balances
      let balance_sol = 0;
      let balance_usdt = 0;
      let escrow_sol = 0;
      let escrow_usdt = 0;

      transactions?.forEach((tx) => {
        if (tx.transaction_type === 'deposit' || tx.transaction_type === 'payment_received' || tx.transaction_type === 'escrow_release') {
          balance_sol += parseFloat(tx.amount_sol.toString());
          if (tx.amount_usdt) balance_usdt += parseFloat(tx.amount_usdt.toString());
        } else if (tx.transaction_type === 'withdrawal' || tx.transaction_type === 'payment_sent' || tx.transaction_type === 'escrow_lock') {
          balance_sol -= parseFloat(tx.amount_sol.toString());
          if (tx.amount_usdt) balance_usdt -= parseFloat(tx.amount_usdt.toString());
        }
        
        if (tx.transaction_type === 'escrow_lock') {
          escrow_sol += parseFloat(tx.amount_sol.toString());
          if (tx.amount_usdt) escrow_usdt += parseFloat(tx.amount_usdt.toString());
        } else if (tx.transaction_type === 'escrow_release') {
          escrow_sol -= parseFloat(tx.amount_sol.toString());
          if (tx.amount_usdt) escrow_usdt -= parseFloat(tx.amount_usdt.toString());
        }
      });

      return new Response(
        JSON.stringify({
          balance_sol,
          balance_usdt,
          escrow_sol,
          escrow_usdt,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return errorResponse('Method not allowed', 405);
  } catch (error) {
    return errorResponse(error.message, 500);
  }
});
