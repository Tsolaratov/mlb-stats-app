import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeaders, isLeaderStat, type LeaderStat } from "@/lib/db/leaders";
import { getCurrentSeason } from "@/lib/season";

const STAT_OPTIONS: { value: LeaderStat; label: string }[] = [
  { value: "avg", label: "打率" },
  { value: "hr", label: "本塁打" },
  { value: "rbi", label: "打点" },
  { value: "era", label: "防御率" },
  { value: "wins", label: "勝利" },
  { value: "so", label: "奪三振" },
];

export default async function LeadersPage({
  searchParams,
}: {
  searchParams: Promise<{ stat?: string; season?: string }>;
}) {
  const params = await searchParams;
  const season = params.season ? parseInt(params.season, 10) : await getCurrentSeason();
  if (Number.isNaN(season)) notFound();
  // params.stat flows into a raw Supabase column name, so it must be whitelisted.
  const stat: LeaderStat = isLeaderStat(params.stat) ? params.stat : "avg";
  const leaders = await getLeaders(season, stat);

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">リーダーボード ({season})</h1>
      <nav className="flex gap-3 mb-4 flex-wrap">
        {STAT_OPTIONS.map((opt) => (
          <Link
            key={opt.value}
            href={`/leaders?stat=${opt.value}&season=${season}`}
            className={opt.value === stat ? "font-bold underline" : "text-blue-600"}
          >
            {opt.label}
          </Link>
        ))}
      </nav>
      <ol className="list-decimal list-inside space-y-1">
        {leaders.map((row) => (
          <li key={row.player_id}>
            <Link href={`/players/${row.player_id}`} className="hover:underline">
              {row.full_name}
            </Link>{" "}
            — {String(row[stat])}
          </li>
        ))}
      </ol>
    </main>
  );
}
