import type { SeasonStatRow, CareerStatRow, StatType } from "@/lib/db/types";

const HITTING_COLUMNS: { key: string; label: string }[] = [
  { key: "games", label: "試合" },
  { key: "avg", label: "打率" },
  { key: "hr", label: "本塁打" },
  { key: "rbi", label: "打点" },
  { key: "obp", label: "出塁率" },
  { key: "slg", label: "長打率" },
];

const PITCHING_COLUMNS: { key: string; label: string }[] = [
  { key: "games", label: "登板" },
  { key: "wins", label: "勝利" },
  { key: "losses", label: "敗戦" },
  { key: "era", label: "防御率" },
  { key: "so", label: "奪三振" },
  { key: "whip", label: "WHIP" },
];

export default function StatsTable({
  rows,
  statType,
  showSeason = false,
}: {
  rows: (SeasonStatRow | CareerStatRow)[];
  statType: StatType;
  showSeason?: boolean;
}) {
  const filtered = rows.filter((r) => r.stat_type === statType);
  if (filtered.length === 0) return null;

  const columns = statType === "hitting" ? HITTING_COLUMNS : PITCHING_COLUMNS;

  return (
    <table className="w-full text-left text-sm mb-4 border-collapse font-data">
      <thead>
        <tr className="font-display uppercase text-xs tracking-wide text-ink-soft">
          {showSeason && <th className="px-3 py-1 font-normal">年度</th>}
          {columns.map((c) => (
            <th key={c.key} className="px-3 py-1 font-normal">{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filtered.map((row, i) => (
          <tr key={i} className="border-t border-card-line">
            {showSeason && "season" in row && <td className="px-3 py-1">{row.season}</td>}
            {columns.map((c) => (
              <td key={c.key} className="px-3 py-1">{String((row as unknown as Record<string, unknown>)[c.key] ?? "-")}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
