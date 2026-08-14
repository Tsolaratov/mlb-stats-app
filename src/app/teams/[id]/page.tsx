import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamById, getTeamRoster } from "@/lib/db/teams";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const teamId = parseInt(id, 10);
  const team = await getTeamById(teamId);
  if (!team) notFound();

  const season = new Date().getFullYear();
  const roster = await getTeamRoster(teamId, season);

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">{team.name}</h1>
      <ul className="space-y-1">
        {roster.map((r) => (
          <li key={`${r.player_id}-${r.stat_type}`}>
            <Link href={`/players/${r.player_id}`} className="text-blue-600 hover:underline">
              {r.players?.full_name ?? r.player_id}
            </Link>{" "}
            {r.stat_type === "hitting" ? `打率 ${r.avg ?? "-"}` : `防御率 ${r.era ?? "-"}`}
          </li>
        ))}
      </ul>
    </main>
  );
}
