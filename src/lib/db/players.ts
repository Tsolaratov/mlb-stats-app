import { createSupabaseClient } from "../supabase/client";
import { createSupabaseAdminClient } from "../supabase/admin";
import type { PlayerRow, SeasonStatRow, CareerStatRow } from "./types";

export async function searchPlayers(query: string, limit = 20): Promise<PlayerRow[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .ilike("full_name", `%${query}%`)
    .order("is_active", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getPlayerById(id: number): Promise<PlayerRow | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("players").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertPlayers(players: PlayerRow[]): Promise<void> {
  if (players.length === 0) return;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("players").upsert(players, { onConflict: "id" });
  if (error) throw error;
}

export async function markPlayerHistorySynced(id: number): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("players").update({ history_synced: true }).eq("id", id);
  if (error) throw error;
}

export async function getSeasonStatsForPlayer(playerId: number): Promise<SeasonStatRow[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("season_stats")
    .select("*")
    .eq("player_id", playerId)
    .order("season", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertSeasonStats(rows: SeasonStatRow[]): Promise<void> {
  if (rows.length === 0) return;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("season_stats")
    .upsert(rows, { onConflict: "player_id,season,stat_type,team_id" });
  if (error) throw error;
}

export async function getCareerStatsForPlayer(playerId: number): Promise<CareerStatRow[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("career_stats")
    .select("*")
    .eq("player_id", playerId);
  if (error) throw error;
  return data ?? [];
}

export async function upsertCareerStats(rows: CareerStatRow[]): Promise<void> {
  if (rows.length === 0) return;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("career_stats")
    .upsert(rows, { onConflict: "player_id,stat_type" });
  if (error) throw error;
}
