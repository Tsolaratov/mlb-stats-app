import { notFound } from "next/navigation";
import { getPlayerById } from "@/lib/db/players";
import { getOrFetchPlayerStats } from "@/lib/player-stats-service";
import StatsTable from "@/components/StatsTable";
import type { SeasonStatRow, CareerStatRow } from "@/lib/db/types";

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const playerId = parseInt(id, 10);
  const player = await getPlayerById(playerId);
  if (!player) notFound();

  let seasonStats: SeasonStatRow[] = [];
  let careerStats: CareerStatRow[] = [];
  let fetchError = false;
  try {
    const stats = await getOrFetchPlayerStats(playerId);
    seasonStats = stats.seasonStats;
    careerStats = stats.careerStats;
  } catch {
    fetchError = true;
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">{player.full_name}</h1>
      <p className="text-gray-500">
        {player.primary_position} {player.is_active ? "(現役)" : "(引退)"}
      </p>

      {fetchError && <p className="text-red-500">成績を取得できませんでした。</p>}

      {!fetchError && (
        <>
          <section>
            <h2 className="text-lg font-semibold mb-2">通算成績</h2>
            <StatsTable rows={careerStats} statType="hitting" />
            <StatsTable rows={careerStats} statType="pitching" />
          </section>
          <section>
            <h2 className="text-lg font-semibold mb-2">年度別成績</h2>
            <StatsTable rows={seasonStats} statType="hitting" showSeason />
            <StatsTable rows={seasonStats} statType="pitching" showSeason />
          </section>
        </>
      )}
    </main>
  );
}
