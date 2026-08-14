import { NextRequest, NextResponse } from "next/server";
import { fetchPlayersBySeason, fetchTeams, fetchStandings, fetchPlayerStats } from "@/lib/mlb-api/client";
import { mapPlayer, mapTeam, mapStanding, mapSeasonStats, mapCareerStats } from "@/lib/mlb-api/transform";
import { upsertPlayers, upsertSeasonStats, upsertCareerStats } from "@/lib/db/players";
import { upsertTeams } from "@/lib/db/teams";
import { upsertStandings } from "@/lib/db/standings";
import { mapWithConcurrency } from "@/lib/concurrency";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const season = new Date().getFullYear();

  const teams = await fetchTeams(season);
  await upsertTeams(teams.map(mapTeam));

  const standings = await fetchStandings(season);
  await upsertStandings(standings.map((r) => mapStanding(r, season)));

  const activePlayers = await fetchPlayersBySeason(season);
  await upsertPlayers(activePlayers.map(mapPlayer));

  const results = await mapWithConcurrency(activePlayers, 25, async (person) => {
    try {
      const groups = await fetchPlayerStats(person.id, "season,career", season);
      await upsertSeasonStats(mapSeasonStats(person.id, groups));
      await upsertCareerStats(mapCareerStats(person.id, groups));
      return true;
    } catch (err) {
      console.error(`Failed to sync stats for player ${person.id}:`, err);
      return false;
    }
  });
  const statsSynced = results.filter(Boolean).length;

  return NextResponse.json({
    ok: true,
    teams: teams.length,
    standings: standings.length,
    players: activePlayers.length,
    statsSynced,
  });
}
