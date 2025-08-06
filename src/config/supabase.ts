import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env files.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface SupabaseLoginData {
  phone: string;
  password: string;
}

export interface SupabaseLoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: {
    id: string;
    email?: string;
    phone?: string;
    created_at: string;
    updated_at: string;
  };
} 