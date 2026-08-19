import {
  createClient,
} from "@supabase/supabase-js";


const supabaseUrl =
  process.env
    .NEXT_PUBLIC_SUPABASE_URL;


const supabaseAnonKey =
  process.env
    .NEXT_PUBLIC_SUPABASE_ANON_KEY;


if (!supabaseUrl) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL."
  );
}


if (!supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
}


/*
 * Compatibility Supabase client.
 *
 * Older SlateLane pages import:
 *
 *   import { supabase } from "@/lib/supabase";
 *
 * Newer backend/admin code uses:
 *
 *   @/lib/supabase/server
 *   @/lib/supabase/admin
 *
 * Keep this file so both architectures work.
 */
export const supabase =
  createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );