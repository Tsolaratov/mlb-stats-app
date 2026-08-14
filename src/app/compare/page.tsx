import { getPlayerById, getCareerStatsForPlayer } from "@/lib/db/players";
import ComparePicker from "@/components/ComparePicker";

const COMPARE_STATS = ["avg", "hr", "rbi", "obp", "slg", "era", "wins", "so"] as const;
const PITCHING_STATS = new Set(["era", "wins", "so"]);

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ players?: string }>;
}) {
  const { players: playersParam } = await searchParams;
  const ids = Array.from(
    new Set(
      (playersParam ?? "")
        .split(",")
        .map((s) => parseInt(s, 10))
        .filter((n) => !isNaN(n))
    )
  ).slice(0, 5);

  const entries = await Promise.all(
    ids.map(async (id) => {
      const player = await getPlayerById(id);
      if (!player) return null;
      const stats = await getCareerStatsForPlayer(id);
      return { player, stats };
    })
  );
  const valid = entries.filter((e): e is NonNullable<typeof e> => e !== null);

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">選手比較</h1>
      <ComparePicker selectedIds={ids} />
      {valid.length > 0 && (
        <table className="w-full text-left mt-6">
          <thead>
            <tr>
              <th>指標</th>
              {valid.map((v) => (
                <th key={v.player.id}>{v.player.full_name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE_STATS.map((stat) => {
              const statType = PITCHING_STATS.has(stat) ? "pitching" : "hitting";
              return (
                <tr key={stat}>
                  <td>{stat}</td>
                  {valid.map((v) => {
                    const row = v.stats.find((s) => s.stat_type === statType);
                    const value = row ? (row as unknown as Record<string, unknown>)[stat] : null;
                    return <td key={v.player.id}>{value === null || value === undefined ? "-" : String(value)}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
