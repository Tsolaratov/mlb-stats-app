import { createSupabaseClient } from "./supabase/client";

/**
 * The season the read-side pages should display.
 *
 * `new Date().getFullYear()` is wrong outside the MLB season (Jan-Mar), when the
 * calendar year has no rows yet and every page would render empty. Fall back to
 * the most recent season that actually has standings data.
 */
export async function getCurrentSeason(): Promise<number> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("team_standings")
    .select("season")
    .order("season", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.season ?? new Date().getFullYear();
}
