import { RegisterUserRequest, RegisterUserResponse } from "@/interfaces";

// Supabase configuration
const SUPABASE_PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_API_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function registerUser(userData: RegisterUserRequest): Promise<RegisterUserResponse> {
  try {
    const response = await fetch(`${SUPABASE_PROJECT_URL}/functions/v1/auth-register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_API_KEY,
      },
      body: JSON.stringify({
        email: userData.email,
        password: userData.password,
        username: userData.username,
        role: userData.role,
        solana_wallet_address: userData.solana_wallet_address,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: RegisterUserResponse = await response.json();
    return data;

  } catch (error) {
    console.error('Registration error:', error);
    
   throw error
  }
}

export async function loginUser(email: string, password: string): Promise<RegisterUserResponse> {
  try {
    const response = await fetch(`${SUPABASE_PROJECT_URL}/functions/v1/auth-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_API_KEY,
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: RegisterUserResponse = await response.json();
    return data;

  } catch (error) {
    console.error('Login error:', error);
    
    throw error
  }
}




