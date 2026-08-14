import { createSupabaseClient } from "../supabase/client";

const HITTING_STATS = ["avg", "hr", "rbi", "obp", "slg", "sb"] as const;
const PITCHING_STATS = ["era", "wins", "so", "saves", "whip"] as const;
export type LeaderStat = (typeof HITTING_STATS)[number] | (typeof PITCHING_STATS)[number];

const ASCENDING_STATS = new Set<string>(["era", "whip"]);

export interface LeaderRow {
  player_id: number;
  full_name: string;
  [stat: string]: unknown;
}

export async function getLeaders(
  season: number,
  stat: LeaderStat,
  limit = 25
): Promise<LeaderRow[]> {
  const supabase = createSupabaseClient();
  const statType = (PITCHING_STATS as readonly string[]).includes(stat) ? "pitching" : "hitting";
  const ascending = ASCENDING_STATS.has(stat);

  const { data, error } = await supabase
    .from("season_stats")
    .select(`*, players(full_name)`)
    .eq("season", season)
    .eq("stat_type", statType)
    .not(stat, "is", null)
    .order(stat, { ascending })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    full_name: (row.players as { full_name?: string } | null)?.full_name ?? "",
  })) as LeaderRow[];
}
