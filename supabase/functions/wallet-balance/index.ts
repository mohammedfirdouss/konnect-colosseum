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

    // GET /wallet/balance - Get user's wallet balance
    if (req.method === 'GET') {
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

      // Calculate balance from transactions
      const { data: transactions, error: transError } = await supabaseClient
        .from('wallet_transactions')
        .select('transaction_type, amount_sol, amount_usdt, status')
        .eq('user_id', user.id)
        .eq('status', 'completed');

      if (transError) {
        return new Response(
          JSON.stringify({ error: transError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
