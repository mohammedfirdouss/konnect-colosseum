import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, createSupabaseClient, errorResponse } from '../_shared/utils.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return errorResponse('Email and password are required', 400);
    }

    const supabaseClient = createSupabaseClient(req);

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return errorResponse(error.message, 401);
    }

    // Create a new client with the user's access token to fetch the profile
    const supabaseClientWithAuth = createSupabaseClient(new Request(req.url, {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    }));

    // Fetch user profile
    const { data: profile } = await supabaseClientWithAuth
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    return new Response(
      JSON.stringify({
        user: data.user,
        session: data.session,
        profile,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return errorResponse(error.message, 500);
  }
});
