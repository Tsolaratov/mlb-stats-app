import Link from "next/link";
import { getStandings } from "@/lib/db/standings";
import { getTeams } from "@/lib/db/teams";
import type { StandingRow } from "@/lib/db/types";
import { getCurrentSeason } from "@/lib/season";
import Card from "@/components/Card";

export default async function TeamsPage() {
  const season = await getCurrentSeason();
  const [standings, teams] = await Promise.all([getStandings(season), getTeams()]);
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const byDivision = new Map<string, StandingRow[]>();
  for (const s of standings) {
    const team = teamById.get(s.team_id);
    const key = `${team?.league ?? "?"} - ${team?.division ?? "?"}`;
    if (!byDivision.has(key)) byDivision.set(key, []);
    byDivision.get(key)!.push(s);
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-8">
      <h1 className="font-display font-bold uppercase text-3xl tracking-wide">
        チーム順位表 <span className="text-amber">({season})</span>
      </h1>
      {Array.from(byDivision.entries()).map(([division, rows]) => (
        <section key={division} className="space-y-2">
          <h2 className="font-display uppercase tracking-wide text-sm text-amber">{division}</h2>
          <Card>
            <table className="w-full text-left border-collapse font-data text-sm">
              <thead>
                <tr className="font-display uppercase text-xs tracking-wide text-ink-soft">
                  <th className="px-3 py-1 font-normal">チーム</th>
                  <th className="px-3 py-1 font-normal">勝</th>
                  <th className="px-3 py-1 font-normal">敗</th>
                  <th className="px-3 py-1 font-normal">勝率</th>
                  <th className="px-3 py-1 font-normal">差</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.team_id} className="border-t border-card-line">
                    <td className="px-3 py-1 font-body">
                      <Link href={`/teams/${s.team_id}`} className="text-seam hover:underline">
                        {teamById.get(s.team_id)?.name ?? s.team_id}
                      </Link>
                    </td>
                    <td className="px-3 py-1">{s.wins}</td>
                    <td className="px-3 py-1">{s.losses}</td>
                    <td className="px-3 py-1">{s.win_pct}</td>
                    <td className="px-3 py-1">{s.games_back}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      ))}
    </main>
  );
}
