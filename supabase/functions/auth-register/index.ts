import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { handleCors, createServiceRoleSupabaseClient, errorResponse } from '../_shared/utils.ts';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string(),
  role: z.enum(['buyer', 'seller', 'both']).optional(),
  solana_wallet_address: z.string().optional(),
});

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const body = await req.json();
    const { email, password, username, role = 'buyer', solana_wallet_address } = registerSchema.parse(body);

    const supabaseClient = createServiceRoleSupabaseClient();

    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
      email,
      password,
    });

    if (authError) {
      return errorResponse(authError.message, 400);
    }

    if (!authData.user) {
      return errorResponse('Failed to create user', 500);
    }

    const { data: profileData, error: profileError } = await supabaseClient
      .from('users')
      .insert({
        id: authData.user.id,
        email: authData.user.email!,
        username,
        role,
        solana_wallet_address,
      })
      .select()
      .single();

    if (profileError) {
      await supabaseClient.auth.admin.deleteUser(authData.user.id);
      return errorResponse(profileError.message, 400);
    }

    return new Response(
      JSON.stringify({
        user: authData.user,
        profile: profileData,
        message: 'User registered successfully',
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(JSON.stringify(error.issues), 400);
    }
    return errorResponse(error.message, 500);
  }
});
