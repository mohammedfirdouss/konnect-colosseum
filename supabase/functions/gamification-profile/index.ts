import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, createSupabaseClient, errorResponse } from '../_shared/utils.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseClient = createSupabaseClient(req);

    // GET /gamification/profile - Get user's gamification data
    if (req.method === 'GET') {
      const {
        data: { user },
        error: userError,
      } = await supabaseClient.auth.getUser();

      if (userError || !user) {
        return errorResponse('Unauthorized', 401);
      }

      const { data, error } = await supabaseClient
        .from('user_gamification')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        return errorResponse(error.message, 500);
      }

      // Calculate level based on points (simple formula: level = floor(points / 100) + 1)
      const calculatedLevel = Math.floor((data.total_points || 0) / 100) + 1;
      
      // Update level if it has changed
      if (calculatedLevel !== data.current_level) {
        await supabaseClient
          .from('user_gamification')
          .update({ current_level: calculatedLevel })
          .eq('user_id', user.id);
        
        data.current_level = calculatedLevel;
      }

      return new Response(
        JSON.stringify({ gamification: data }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return errorResponse('Method not allowed', 405);
  } catch (error) {
    return errorResponse(error.message, 500);
  }
});
