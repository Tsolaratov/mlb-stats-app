import { createSupabaseClient } from "../supabase/client";
import { createSupabaseAdminClient } from "../supabase/admin";
import type { TeamRow } from "./types";

export interface TeamRosterRow {
  player_id: number;
  stat_type: "hitting" | "pitching";
  avg: number | null;
  hr: number | null;
  era: number | null;
  wins: number | null;
  players: { full_name: string } | null;
}

export async function getTeams(): Promise<TeamRow[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("teams").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getTeamById(id: number): Promise<TeamRow | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("teams").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertTeams(teams: TeamRow[]): Promise<void> {
  if (teams.length === 0) return;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("teams").upsert(teams, { onConflict: "id" });
  if (error) throw error;
}

export async function getTeamRoster(teamId: number, season: number): Promise<TeamRosterRow[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("season_stats")
    .select("player_id, stat_type, avg, hr, era, wins, players(full_name)")
    .eq("team_id", teamId)
    .eq("season", season);
  if (error) throw error;
  return (data ?? []) as unknown as TeamRosterRow[];
}
