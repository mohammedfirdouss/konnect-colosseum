import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user_id, badge_name } = await req.json();

    if (!user_id || !badge_name) {
      return new Response(
        JSON.stringify({ error: 'user_id and badge_name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch the user's gamification data
    const { data: gamificationData, error: gamificationError } = await supabaseClient
      .from('user_gamification')
      .select('badges')
      .eq('user_id', user_id)
      .single();

    if (gamificationError) {
      return new Response(
        JSON.stringify({ error: gamificationError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add the new badge to the list of badges
    const updatedBadges = [...(gamificationData.badges || []), badge_name];

    // Update the user's gamification data
    const { error: updateError } = await supabaseClient
      .from('user_gamification')
      .update({ badges: updatedBadges })
      .eq('user_id', user_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ message: `Badge '${badge_name}' awarded to user ${user_id}` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
