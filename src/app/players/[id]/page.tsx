import { notFound } from "next/navigation";
import { getPlayerById } from "@/lib/db/players";
import { getOrFetchPlayerStats } from "@/lib/player-stats-service";
import StatsTable from "@/components/StatsTable";
import Card from "@/components/Card";
import type { SeasonStatRow, CareerStatRow } from "@/lib/db/types";

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const playerId = parseInt(id, 10);
  if (Number.isNaN(playerId)) notFound();
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
    <main className="max-w-3xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="font-display font-bold uppercase text-4xl tracking-wide">
          {player.full_name}
        </h1>
        <p className="text-card/80 font-body mt-1">
          {player.primary_position}{" "}
          <span className={player.is_active ? "text-amber" : "text-card/60"}>
            {player.is_active ? "(現役)" : "(引退)"}
          </span>
        </p>
      </div>

      {fetchError && (
        <Card>
          <p className="text-seam">成績を取得できませんでした。</p>
        </Card>
      )}

      {!fetchError && (
        <>
          <section className="space-y-2">
            <h2 className="font-display uppercase tracking-wide text-sm text-amber">通算成績</h2>
            <Card>
              <StatsTable rows={careerStats} statType="hitting" />
              <StatsTable rows={careerStats} statType="pitching" />
            </Card>
          </section>
          <section className="space-y-2">
            <h2 className="font-display uppercase tracking-wide text-sm text-amber">年度別成績</h2>
            <Card>
              <StatsTable rows={seasonStats} statType="hitting" showSeason />
              <StatsTable rows={seasonStats} statType="pitching" showSeason />
            </Card>
          </section>
        </>
      )}
    </main>
  );
}
