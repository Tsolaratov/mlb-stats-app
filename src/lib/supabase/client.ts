import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createSupabaseClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
