import { fetchPlayerStats } from "./mlb-api/client";
import { mapSeasonStats, mapCareerStats } from "./mlb-api/transform";
import {
  getPlayerById,
  getSeasonStatsForPlayer,
  getCareerStatsForPlayer,
  upsertSeasonStats,
  upsertCareerStats,
  markPlayerHistorySynced,
} from "./db/players";
import type { SeasonStatRow, CareerStatRow } from "./db/types";

export async function getOrFetchPlayerStats(
  playerId: number
): Promise<{ seasonStats: SeasonStatRow[]; careerStats: CareerStatRow[] }> {
  const player = await getPlayerById(playerId);
  if (!player) {
    throw new Error(`Player not found: ${playerId}`);
  }

  if (!player.history_synced) {
    const groups = await fetchPlayerStats(playerId, "yearByYear,career");
    await upsertSeasonStats(mapSeasonStats(playerId, groups));
    await upsertCareerStats(mapCareerStats(playerId, groups));
    await markPlayerHistorySynced(playerId);
  }

  const [seasonStats, careerStats] = await Promise.all([
    getSeasonStatsForPlayer(playerId),
    getCareerStatsForPlayer(playerId),
  ]);

  return { seasonStats, careerStats };
}
