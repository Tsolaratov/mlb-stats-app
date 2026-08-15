"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/Card";

interface SearchResult {
  id: number;
  full_name: string;
}

const MAX_PLAYERS = 5;

export default function ComparePicker({ selectedIds }: { selectedIds: number[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  async function handleSearch(value: string) {
    setQuery(value);
    if (value.length < 2) {
      setResults([]);
      return;
    }
    const res = await fetch(`/api/players/search?q=${encodeURIComponent(value)}`);
    if (!res.ok) {
      // Never throw inside an event handler; degrade to no suggestions.
      setResults([]);
      return;
    }
    const data = await res.json();
    setResults(data.players ?? []);
  }

  function addPlayer(id: number) {
    if (selectedIds.includes(id) || selectedIds.length >= MAX_PLAYERS) return;
    const next = [...selectedIds, id];
    router.push(`/compare?players=${next.join(",")}`);
    setQuery("");
    setResults([]);
  }

  function removePlayer(id: number) {
    router.push(`/compare?players=${selectedIds.filter((existing) => existing !== id).join(",")}`);
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="選手を追加(2文字以上、最大5人)"
        className="bg-card text-ink placeholder:text-ink-soft border border-card-line rounded-sm px-3 py-2 w-full font-body focus:outline-none focus:ring-2 focus:ring-amber"
      />
      {results.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y divide-card-line">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => addPlayer(r.id)}
                  className="px-3 py-2 hover:bg-amber/20 w-full text-left font-body"
                >
                  {r.full_name}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div className="flex gap-2 flex-wrap">
        {selectedIds.map((id) => (
          <button
            key={id}
            onClick={() => removePlayer(id)}
            className="border border-amber text-amber rounded-sm px-2 py-1 text-sm font-data hover:bg-amber hover:text-field-dark transition-colors"
          >
            ID:{id} ✕
          </button>
        ))}
      </div>
    </div>
  );
}
