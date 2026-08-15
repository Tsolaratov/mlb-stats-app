import Link from "next/link";
import { getLeaders } from "@/lib/db/leaders";
import { getStandings } from "@/lib/db/standings";
import { getTeams } from "@/lib/db/teams";
import { getCurrentSeason } from "@/lib/season";
import Card from "@/components/Card";
import RankBadge from "@/components/RankBadge";

export const revalidate = 3600;

export default async function HomePage() {
  const season = await getCurrentSeason();
  const [hrLeaders, avgLeaders, standings, teams] = await Promise.all([
    getLeaders(season, "hr", 5),
    getLeaders(season, "avg", 5),
    getStandings(season),
    getTeams(),
  ]);
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-10">
      <div>
        <p className="font-display uppercase tracking-[0.3em] text-amber text-xs mb-1">
          Scorecard — {season}
        </p>
        <h1 className="font-display font-bold uppercase text-4xl tracking-wide">MLB Stats</h1>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <h2 className="font-display uppercase tracking-wide text-sm text-ink-soft border-b border-card-line pb-2 mb-3">
            本塁打リーダー ({season})
          </h2>
          <ol>
            {hrLeaders.map((row, i) => (
              <li key={row.player_id} className="flex items-center py-1">
                <RankBadge rank={i + 1} />
                <Link href={`/players/${row.player_id}`} className="text-seam hover:underline flex-1">
                  {row.full_name}
                </Link>
                <span className="font-data font-bold">{String(row.hr)}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <h2 className="font-display uppercase tracking-wide text-sm text-ink-soft border-b border-card-line pb-2 mb-3">
            打率リーダー ({season})
          </h2>
          <ol>
            {avgLeaders.map((row, i) => (
              <li key={row.player_id} className="flex items-center py-1">
                <RankBadge rank={i + 1} />
                <Link href={`/players/${row.player_id}`} className="text-seam hover:underline flex-1">
                  {row.full_name}
                </Link>
                <span className="font-data font-bold">{String(row.avg)}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card>
        <h2 className="font-display uppercase tracking-wide text-sm text-ink-soft border-b border-card-line pb-2 mb-3">
          チーム順位 ({season})
        </h2>
        <table className="w-full text-left border-collapse font-data text-sm">
          <thead>
            <tr className="font-display uppercase text-xs tracking-wide text-ink-soft">
              <th className="px-3 py-1 font-normal">チーム</th>
              <th className="px-3 py-1 font-normal">勝</th>
              <th className="px-3 py-1 font-normal">敗</th>
              <th className="px-3 py-1 font-normal">勝率</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => (
              <tr key={s.team_id} className="border-t border-card-line">
                <td className="px-3 py-1 font-body">
                  <Link href={`/teams/${s.team_id}`} className="text-seam hover:underline">
                    {teamNameById.get(s.team_id) ?? s.team_id}
                  </Link>
                </td>
                <td className="px-3 py-1">{s.wins}</td>
                <td className="px-3 py-1">{s.losses}</td>
                <td className="px-3 py-1">{s.win_pct}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </main>
  );
}
