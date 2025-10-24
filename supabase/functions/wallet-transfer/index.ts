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

    // POST /wallet/transfer - Handle peer-to-peer transfers
    if (req.method === 'POST') {
      const { recipient_id, amount_sol, amount_usdt, transaction_signature, notes } = await req.json();

      if (!recipient_id || (!amount_sol && !amount_usdt)) {
        return new Response(
          JSON.stringify({ error: 'recipient_id and amount are required' }),
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

      if (user.id === recipient_id) {
        return new Response(
          JSON.stringify({ error: 'Cannot transfer to yourself' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
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
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ transactions: data }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
