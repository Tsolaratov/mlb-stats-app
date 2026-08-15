import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeaders, isLeaderStat, type LeaderStat } from "@/lib/db/leaders";
import { getCurrentSeason } from "@/lib/season";
import Card from "@/components/Card";
import RankBadge from "@/components/RankBadge";

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
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="font-display font-bold uppercase text-3xl tracking-wide">
        リーダーボード <span className="text-amber">({season})</span>
      </h1>
      <nav className="flex gap-4 flex-wrap font-display uppercase text-sm tracking-wide">
        {STAT_OPTIONS.map((opt) => (
          <Link
            key={opt.value}
            href={`/leaders?stat=${opt.value}&season=${season}`}
            className={
              opt.value === stat
                ? "text-amber border-b-2 border-amber pb-0.5"
                : "text-card/70 hover:text-amber"
            }
          >
            {opt.label}
          </Link>
        ))}
      </nav>
      <Card>
        <ol className="divide-y divide-card-line">
          {leaders.map((row, i) => (
            <li key={row.player_id} className="flex items-center py-2">
              <RankBadge rank={i + 1} />
              <Link href={`/players/${row.player_id}`} className="text-seam hover:underline flex-1">
                {row.full_name}
              </Link>
              <span className="font-data font-bold">{String(row[stat])}</span>
            </li>
          ))}
        </ol>
      </Card>
    </main>
  );
}
