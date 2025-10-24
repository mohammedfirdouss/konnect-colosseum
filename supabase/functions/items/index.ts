import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, createSupabaseClient, errorResponse } from '../_shared/utils.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseClient = createSupabaseClient(req);

    // GET /items - Fetch all active items
    if (req.method === 'GET') {
      const { data, error } = await supabaseClient
        .from('items')
        .select('*, seller:users(username, email)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        return errorResponse(error.message, 500);
      }

      return new Response(
        JSON.stringify({ items: data }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // POST /items - Create a new item listing
    if (req.method === 'POST') {
      const {
        title,
        description,
        category,
        price_sol,
        price_usdt,
        images,
        tags,
        condition,
      } = await req.json();

      // Validate required fields
      if (!title || !category || !price_sol) {
        return errorResponse('Title, category, and price_sol are required', 400);
      }

      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabaseClient.auth.getUser();

      if (userError || !user) {
        return errorResponse('Unauthorized', 401);
      }

      const { data, error } = await supabaseClient
        .from('items')
        .insert({
          seller_id: user.id,
          title,
          description,
          category,
          price_sol,
          price_usdt,
          images,
          tags,
          condition,
        })
        .select()
        .single();

      if (error) {
        return errorResponse(error.message, 500);
      }

      return new Response(
        JSON.stringify({ item: data }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return errorResponse('Method not allowed', 405);
  } catch (error) {
    return errorResponse(error.message, 500);
  }
});
