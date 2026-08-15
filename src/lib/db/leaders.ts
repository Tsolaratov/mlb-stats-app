import { createSupabaseClient } from "../supabase/client";

const HITTING_STATS = ["avg", "hr", "rbi", "obp", "slg", "sb"] as const;
const PITCHING_STATS = ["era", "wins", "so", "saves", "whip"] as const;
export type LeaderStat = (typeof HITTING_STATS)[number] | (typeof PITCHING_STATS)[number];

export const LEADER_STATS: readonly LeaderStat[] = [...HITTING_STATS, ...PITCHING_STATS];

/** Narrows an arbitrary (user-supplied) string to a known stat column name. */
export function isLeaderStat(value: string | undefined): value is LeaderStat {
  return value !== undefined && (LEADER_STATS as readonly string[]).includes(value);
}

const ASCENDING_STATS = new Set<string>(["era", "whip"]);

/** Minimum playing time required to appear on a leaderboard. */
const MIN_AT_BATS = 20;
const MIN_INNINGS_PITCHED = 10;

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

  let query = supabase
    .from("season_stats")
    .select(`*, players(full_name)`)
    .eq("season", season)
    .eq("stat_type", statType)
    .not(stat, "is", null);

  // Qualifier: keep 1-for-1 hitters and one-inning pitchers off the boards.
  query =
    statType === "pitching"
      ? query.gte("innings_pitched", MIN_INNINGS_PITCHED)
      : query.gte("at_bats", MIN_AT_BATS);

  const { data, error } = await query.order(stat, { ascending }).limit(limit);
  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    full_name: (row.players as { full_name?: string } | null)?.full_name ?? "",
  })) as LeaderRow[];
}
