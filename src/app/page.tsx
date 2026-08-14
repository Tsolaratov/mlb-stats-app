import Link from "next/link";
import { getLeaders } from "@/lib/db/leaders";
import { getStandings } from "@/lib/db/standings";
import { getTeams } from "@/lib/db/teams";

export const revalidate = 3600;

export default async function HomePage() {
  const season = new Date().getFullYear();
  const [hrLeaders, avgLeaders, standings, teams] = await Promise.all([
    getLeaders(season, "hr", 5),
    getLeaders(season, "avg", 5),
    getStandings(season),
    getTeams(),
  ]);
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">MLB Stats</h1>

      <section>
        <h2 className="text-lg font-semibold mb-2">本塁打リーダー ({season})</h2>
        <ol className="list-decimal list-inside">
          {hrLeaders.map((row) => (
            <li key={row.player_id}>
              <Link href={`/players/${row.player_id}`} className="text-blue-600 hover:underline">
                {row.full_name}
              </Link>{" "}
              — {String(row.hr)}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">打率リーダー ({season})</h2>
        <ol className="list-decimal list-inside">
          {avgLeaders.map((row) => (
            <li key={row.player_id}>
              <Link href={`/players/${row.player_id}`} className="text-blue-600 hover:underline">
                {row.full_name}
              </Link>{" "}
              — {String(row.avg)}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">チーム順位 ({season})</h2>
        <table className="w-full text-left">
          <thead>
            <tr>
              <th>チーム</th>
              <th>勝</th>
              <th>敗</th>
              <th>勝率</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => (
              <tr key={s.team_id}>
                <td>
                  <Link href={`/teams/${s.team_id}`} className="text-blue-600 hover:underline">
                    {teamNameById.get(s.team_id) ?? s.team_id}
                  </Link>
                </td>
                <td>{s.wins}</td>
                <td>{s.losses}</td>
                <td>{s.win_pct}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
