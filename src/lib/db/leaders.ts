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

// MLB's official qualifying rate: 3.1 plate appearances per team game played
// for batting titles, 1.0 inning pitched per team game played for ERA.
// This schema doesn't track plate appearances, so at_bats is used as a
// (slightly stricter) approximation — at_bats is always <= true PA.
const QUALIFYING_PA_PER_GAME = 3.1;
const QUALIFYING_IP_PER_GAME = 1.0;

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

  // The qualifying threshold scales with each team's games played so far
  // this season, so fetch that first and filter in JS rather than with a
  // single flat SQL threshold.
  const { data: standings, error: standingsError } = await supabase
    .from("team_standings")
    .select("team_id, wins, losses")
    .eq("season", season);
  if (standingsError) throw standingsError;

  const gamesPlayedByTeam = new Map<number, number>(
    (standings ?? []).map((s) => [s.team_id as number, (s.wins as number) + (s.losses as number)])
  );
  const gamesPlayedValues = Array.from(gamesPlayedByTeam.values());
  // If a row's team is missing from standings, treat it as if it had played
  // as many games as the most-advanced team rather than 0 — a missing
  // standings row should never make a low-sample player look qualified.
  const fallbackGamesPlayed = gamesPlayedValues.length > 0 ? Math.max(...gamesPlayedValues) : 0;

  const { data, error } = await supabase
    .from("season_stats")
    .select(`*, players(full_name)`)
    .eq("season", season)
    .eq("stat_type", statType)
    .not(stat, "is", null)
    .order(stat, { ascending });
  if (error) throw error;

  const qualified = (data ?? []).filter((row: Record<string, unknown>) => {
    const gamesPlayed = gamesPlayedByTeam.get(row.team_id as number) ?? fallbackGamesPlayed;
    if (statType === "pitching") {
      return ((row.innings_pitched as number | null) ?? 0) >= gamesPlayed * QUALIFYING_IP_PER_GAME;
    }
    return ((row.at_bats as number | null) ?? 0) >= gamesPlayed * QUALIFYING_PA_PER_GAME;
  });

  return qualified.slice(0, limit).map((row: Record<string, unknown>) => ({
    ...row,
    full_name: (row.players as { full_name?: string } | null)?.full_name ?? "",
  })) as LeaderRow[];
}
