import dotenv from "dotenv";
import { fetchPlayersBySeason, fetchTeams } from "../src/lib/mlb-api/client";
import { mapPlayer, mapTeam } from "../src/lib/mlb-api/transform";
import { upsertPlayers } from "../src/lib/db/players";
import { upsertTeams } from "../src/lib/db/teams";

// Load .env.local
dotenv.config({ path: ".env.local" });

const FIRST_SEASON = 1876;
const CURRENT_SEASON = new Date().getFullYear();
const BATCH_SIZE = 500;

async function main() {
  // Historical teams: season_stats.team_id has a NOT NULL FK to teams(id), and
  // on-demand stat fetches for retired players reference long-defunct franchises,
  // so every season's team list must be present, not just the current one.
  const teamsById = new Map<number, ReturnType<typeof mapTeam>>();
  for (let season = FIRST_SEASON; season <= CURRENT_SEASON; season++) {
    try {
      const teams = await fetchTeams(season);
      for (const t of teams) {
        teamsById.set(t.id, mapTeam(t));
      }
      console.log(`Season ${season}: ${teams.length} teams (unique so far: ${teamsById.size})`);
    } catch (err) {
      console.error(`Failed to fetch teams for season ${season}:`, err);
    }
  }

  const allTeams = Array.from(teamsById.values());
  for (let i = 0; i < allTeams.length; i += BATCH_SIZE) {
    const batch = allTeams.slice(i, i + BATCH_SIZE);
    await upsertTeams(batch);
    console.log(`Upserted ${Math.min(i + BATCH_SIZE, allTeams.length)}/${allTeams.length} teams`);
  }
  console.log(`Imported ${allTeams.length} unique teams across ${FIRST_SEASON}-${CURRENT_SEASON}`);

  const playersById = new Map<number, ReturnType<typeof mapPlayer>>();
  for (let season = FIRST_SEASON; season <= CURRENT_SEASON; season++) {
    try {
      const players = await fetchPlayersBySeason(season);
      for (const p of players) {
        playersById.set(p.id, mapPlayer(p));
      }
      console.log(`Season ${season}: ${players.length} players (unique so far: ${playersById.size})`);
    } catch (err) {
      console.error(`Failed to fetch season ${season}:`, err);
    }
  }

  const allPlayers = Array.from(playersById.values());
  for (let i = 0; i < allPlayers.length; i += BATCH_SIZE) {
    const batch = allPlayers.slice(i, i + BATCH_SIZE);
    await upsertPlayers(batch);
    console.log(`Upserted ${Math.min(i + BATCH_SIZE, allPlayers.length)}/${allPlayers.length} players`);
  }

  console.log("Initial import complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
