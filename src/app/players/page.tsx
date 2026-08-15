import Link from "next/link";
import { searchPlayers } from "@/lib/db/players";
import Card from "@/components/Card";

export default async function PlayersSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const players = q ? await searchPlayers(q) : [];

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="font-display font-bold uppercase text-3xl tracking-wide">選手検索</h1>
      <form>
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="選手名で検索"
          className="bg-card text-ink placeholder:text-ink-soft border border-card-line rounded-sm px-3 py-2 w-full font-body focus:outline-none focus:ring-2 focus:ring-amber"
        />
      </form>
      {q && players.length === 0 && (
        <p className="text-card/80">「{q}」に一致する選手が見つかりませんでした。</p>
      )}
      {players.length > 0 && (
        <Card>
          <ul className="divide-y divide-card-line">
            {players.map((p) => (
              <li key={p.id} className="py-2">
                <Link href={`/players/${p.id}`} className="text-seam hover:underline font-body">
                  {p.full_name}
                </Link>
                {!p.is_active && <span className="text-ink-soft text-sm ml-2">(引退)</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </main>
  );
}
