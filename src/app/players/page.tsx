import Link from "next/link";
import { searchPlayers } from "@/lib/db/players";

export default async function PlayersSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const players = q ? await searchPlayers(q) : [];

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">選手検索</h1>
      <form className="mb-6">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="選手名で検索"
          className="border px-3 py-2 w-full"
        />
      </form>
      {q && players.length === 0 && <p>「{q}」に一致する選手が見つかりませんでした。</p>}
      <ul className="space-y-2">
        {players.map((p) => (
          <li key={p.id}>
            <Link href={`/players/${p.id}`} className="text-blue-600 hover:underline">
              {p.full_name}
            </Link>
            {!p.is_active && <span className="text-gray-400 text-sm ml-2">(引退)</span>}
          </li>
        ))}
      </ul>
    </main>
  );
}
