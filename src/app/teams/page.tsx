import Link from "next/link";
import { getStandings } from "@/lib/db/standings";
import { getTeams } from "@/lib/db/teams";
import type { StandingRow } from "@/lib/db/types";
import { getCurrentSeason } from "@/lib/season";

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
      <h1 className="text-2xl font-bold">チーム順位表 ({season})</h1>
      {Array.from(byDivision.entries()).map(([division, rows]) => (
        <section key={division}>
          <h2 className="text-lg font-semibold mb-2">{division}</h2>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="px-3 py-1">チーム</th>
                <th className="px-3 py-1">勝</th>
                <th className="px-3 py-1">敗</th>
                <th className="px-3 py-1">勝率</th>
                <th className="px-3 py-1">差</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.team_id} className="border-t">
                  <td className="px-3 py-1">
                    <Link href={`/teams/${s.team_id}`} className="text-blue-600 hover:underline">
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
        </section>
      ))}
    </main>
  );
}
