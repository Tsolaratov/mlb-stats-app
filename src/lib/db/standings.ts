import { createSupabaseClient } from "../supabase/client";
import { createSupabaseAdminClient } from "../supabase/admin";
import type { StandingRow } from "./types";

export async function getStandings(season: number): Promise<StandingRow[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("team_standings")
    .select("*")
    .eq("season", season)
    .order("division_rank", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function upsertStandings(rows: StandingRow[]): Promise<void> {
  if (rows.length === 0) return;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("team_standings")
    .upsert(rows, { onConflict: "team_id,season" });
  if (error) throw error;
}
