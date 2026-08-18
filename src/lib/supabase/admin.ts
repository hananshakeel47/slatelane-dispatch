import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

import WebSocket from "ws";


let client:
  SupabaseClient | null =
  null;


export function createAdminSupabase() {
  if (client) {
    return client;
  }


  const url =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL ??
    process.env
      .SUPABASE_URL;


  const serviceRoleKey =
    process.env
      .SUPABASE_SERVICE_ROLE_KEY;


  if (!url) {
    throw new Error(
      "Missing Supabase URL."
    );
  }


  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY."
    );
  }


  client =
    createClient(
      url,
      serviceRoleKey,
      {
        auth: {
          persistSession:
            false,

          autoRefreshToken:
            false,

          detectSessionInUrl:
            false,
        },

        realtime: {
          transport:
            WebSocket as any,
        },
      }
    );


  return client;
}