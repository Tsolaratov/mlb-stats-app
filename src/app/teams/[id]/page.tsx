import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamById, getTeamRoster } from "@/lib/db/teams";
import { getCurrentSeason } from "@/lib/season";
import Card from "@/components/Card";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const teamId = parseInt(id, 10);
  if (Number.isNaN(teamId)) notFound();
  const team = await getTeamById(teamId);
  if (!team) notFound();

  const season = await getCurrentSeason();
  const roster = await getTeamRoster(teamId, season);

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="font-display font-bold uppercase text-4xl tracking-wide">{team.name}</h1>
      <Card>
        <ul className="divide-y divide-card-line font-data text-sm">
          {roster.map((r) => (
            <li key={`${r.player_id}-${r.stat_type}`} className="flex justify-between py-2">
              <Link href={`/players/${r.player_id}`} className="text-seam hover:underline font-body">
                {r.players?.full_name ?? r.player_id}
              </Link>
              <span>{r.stat_type === "hitting" ? `打率 ${r.avg ?? "-"}` : `防御率 ${r.era ?? "-"}`}</span>
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
